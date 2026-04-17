import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { VehicleScheduleSlot } from '@/lib/models';

// GET - List all slots (optionally filtered by vehicle and/or date)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get('vehicle_id');
    const date = searchParams.get('date');

    const filter: any = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;
    if (date) {
      // Return date-specific slots AND general (no-date) slots
      filter.$or = [{ date }, { date: '' }];
    }

    const slots = await VehicleScheduleSlot.find(filter)
      .populate('vehicle_id')
      .sort({ time: 1 })
      .lean();

    if (date) {
      // Filter out global slots that have a date-specific inactive override
      const dateSlots = slots.filter((s: any) => s.date === date);
      const inactiveOverrides = new Set(
        dateSlots
          .filter((s: any) => s.status === 'inactive')
          .map((s: any) => `${s.vehicle_id?._id || s.vehicle_id}|${s.type}|${s.time}|${s.station_name}`)
      );

      const filtered = slots.filter((s: any) => {
        // Always exclude inactive slots from the result
        if (s.status === 'inactive') return false;
        // For global slots, check if there's a date-specific inactive override
        if (!s.date || s.date === '') {
          const key = `${s.vehicle_id?._id || s.vehicle_id}|${s.type}|${s.time}|${s.station_name}`;
          if (inactiveOverrides.has(key)) return false;
        }
        return true;
      });

      return NextResponse.json({ data: filtered });
    }

    return NextResponse.json({ data: slots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete all slots (optionally filtered by vehicle_id)
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get('vehicle_id');

    const filter: any = {};
    if (vehicle_id) filter.vehicle_id = vehicle_id;

    const result = await VehicleScheduleSlot.deleteMany(filter);

    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Copy all slots from one date to another
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { source_date, target_date } = await request.json();

    if (!source_date || !target_date) {
      return NextResponse.json({ error: 'source_date and target_date are required' }, { status: 400 });
    }

    if (source_date === target_date) {
      return NextResponse.json({ error: 'Source and target dates must be different' }, { status: 400 });
    }

    // Get all slots from source date
    const sourceSlots = await VehicleScheduleSlot.find({ date: source_date }).lean();

    if (sourceSlots.length === 0) {
      return NextResponse.json({ error: 'No slots found on source date to copy' }, { status: 404 });
    }

    // Remove existing slots on target date to avoid duplicates
    await VehicleScheduleSlot.deleteMany({ date: target_date });

    // Create copies with the new date
    const newSlots = sourceSlots.map((slot: any) => ({
      vehicle_id: slot.vehicle_id,
      station_name: slot.station_name,
      type: slot.type,
      date: target_date,
      time: slot.time,
      status: slot.status,
    }));

    const created = await VehicleScheduleSlot.insertMany(newSlots);

    return NextResponse.json({ success: true, count: created.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const formatTime = (totalMin: number) => {
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

// POST - Bulk create slots from start_time, end_time, interval
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { vehicle_id, type, start_time, end_time, interval_minutes } = body;

    if (!vehicle_id || !type || !start_time || !end_time || !interval_minutes) {
      return NextResponse.json(
        { error: 'vehicle_id, type, start_time, end_time, and interval_minutes are required' },
        { status: 400 }
      );
    }

    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    const interval = parseInt(interval_minutes) || 30;

    if (startMin >= endMin || interval < 1) {
      return NextResponse.json({ error: 'Invalid time range or interval' }, { status: 400 });
    }

    const slotsToCreate: any[] = [];

    if (type === 'both') {
      // ============================================================
      // BOTH mode — Round-trip logic (general schedule, no date)
      //
      // Real-world flow for ONE vehicle:
      //   07:00  PICKUP @ Station   → loads patients, drives to hospital
      //   07:30  Arrive Hospital    → (travel_time = 30min)
      //   07:30  DROP   @ Hospital  → loads patients going home, drives to station
      //   08:00  Arrive Station     → (travel_time = 30min)
      //   08:00  PICKUP @ Station   → next round trip
      //
      // pickup_station = where patients board   (e.g. "Taman Melati")
      // drop_station   = hospital / destination (e.g. "Hospital KL")
      //
      // Pickup time at station:  start, start+interval, start+2*interval ...
      // Drop time at hospital:   pickup_time + travel_time
      // ============================================================

      const { pickup_station, drop_station, travel_time } = body;
      if (!pickup_station || !drop_station || !travel_time) {
        return NextResponse.json(
          { error: 'pickup_station, drop_station, and travel_time are required for both mode' },
          { status: 400 }
        );
      }
      const travelMin = parseInt(travel_time) || 30;

      for (let m = startMin; m < endMin; m += interval) {
        // PICKUP slot — vehicle is at STATION at this time
        // Meaning: Station → Hospital
        slotsToCreate.push({
          vehicle_id,
          station_name: pickup_station,
          type: 'pickup',
          date: '',
          time: formatTime(m),
          status: 'active',
        });

        // DROP slot — vehicle arrives at HOSPITAL after travel
        // Meaning: Hospital → Station (picks up patients going home)
        const dropTime = m + travelMin;
        slotsToCreate.push({
          vehicle_id,
          station_name: drop_station,
          type: 'drop',
          date: '',
          time: formatTime(dropTime),
          status: 'active',
        });
      }

      // Remove existing general slots for this vehicle before creating new
      await VehicleScheduleSlot.deleteMany({ vehicle_id, date: '' });

      // Clean up stale date-specific inactive overrides for this vehicle
      // that no longer match any of the new global slot times
      const newPickupTimes = new Set(
        slotsToCreate.filter((s: any) => s.type === 'pickup').map((s: any) => s.time)
      );
      const newDropTimes = new Set(
        slotsToCreate.filter((s: any) => s.type === 'drop').map((s: any) => s.time)
      );

      // Find all inactive overrides for this vehicle
      const staleOverrides = await VehicleScheduleSlot.find({
        vehicle_id,
        date: { $ne: '' },
        status: 'inactive',
      }).lean();

      const staleIds = staleOverrides
        .filter((s: any) => {
          const relevantTimes = s.type === 'pickup' ? newPickupTimes : newDropTimes;
          return !relevantTimes.has(s.time);
        })
        .map((s: any) => s._id);

      if (staleIds.length > 0) {
        await VehicleScheduleSlot.deleteMany({ _id: { $in: staleIds } });
      }

    } else {
      // Single type mode (pickup or drop) — existing behavior
      const { station_name, date } = body;
      if (!station_name || !date) {
        return NextResponse.json(
          { error: 'station_name and date are required for single type mode' },
          { status: 400 }
        );
      }

      for (let m = startMin; m < endMin; m += interval) {
        slotsToCreate.push({
          vehicle_id,
          station_name,
          type,
          date,
          time: formatTime(m),
          status: 'active',
        });
      }

      await VehicleScheduleSlot.deleteMany({ vehicle_id, type, date, station_name });
    }

    if (slotsToCreate.length === 0) {
      return NextResponse.json({ error: 'No time slots to create' }, { status: 400 });
    }

    const created = await VehicleScheduleSlot.insertMany(slotsToCreate);

    return NextResponse.json({ success: true, data: created, count: created.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
