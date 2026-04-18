import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { VehicleScheduleSlot } from '@/lib/models';

// PUT - Update a slot
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    const slot = await VehicleScheduleSlot.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: slot });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a slot
// If ?date=YYYY-MM-DD is provided and the slot is global (date=''),
// create a date-specific inactive override instead of deleting globally.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forDate = searchParams.get('date');

    const slot = await VehicleScheduleSlot.findById(id);
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    // If a specific date is given and the slot is global (no date),
    // create a date-specific inactive override instead of deleting
    if (forDate && (!slot.date || slot.date === '')) {
      // Check if override already exists
      const existing = await VehicleScheduleSlot.findOne({
        vehicle_id: slot.vehicle_id,
        station_name: slot.station_name,
        type: slot.type,
        time: slot.time,
        date: forDate,
      });

      if (existing) {
        // Update existing override to inactive
        existing.status = 'inactive';
        await existing.save();
      } else {
        // Create a date-specific inactive override
        await VehicleScheduleSlot.create({
          vehicle_id: slot.vehicle_id,
          station_name: slot.station_name,
          type: slot.type,
          time: slot.time,
          date: forDate,
          status: 'inactive',
        });
      }

      return NextResponse.json({ success: true, override: true });
    }

    // Otherwise delete normally (date-specific slot or no date param)
    await VehicleScheduleSlot.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
