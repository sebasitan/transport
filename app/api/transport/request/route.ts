import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest } from '@/lib/models';

// POST - Create transport request
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const {
      ic_number,
      appointment_id,
      patient_name,
      phone_number,
      doctor_name,
      service_type = 'pickup',
      pickup_station,
      appointment_date,
      appointment_time,
      pickup_time,
      dropoff_station,
      dropoff_time,
      vehicle_id,
      dropoff_vehicle_id,
      seats,
      transport_required,
    } = body;

    if (!ic_number || !patient_name || !phone_number || !appointment_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate service-specific fields
    if ((service_type === 'pickup' || service_type === 'both') && !pickup_station) {
      return NextResponse.json(
        { error: 'Pickup station is required for pickup service' },
        { status: 400 }
      );
    }
    if ((service_type === 'drop' || service_type === 'both') && !dropoff_station) {
      return NextResponse.json(
        { error: 'Drop-off station is required for drop service' },
        { status: 400 }
      );
    }

    // Check if a transport request already exists for this IC + date + service_type (prevent duplicates)
    const cleanedIC = ic_number.replace(/[-\s]/g, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dateStart = new Date(appointment_date + 'T00:00:00.000Z');
    const dateEnd = new Date(appointment_date + 'T23:59:59.999Z');

    const duplicateFilter: any = {
      ic_number: { $regex: new RegExp(`^${cleanedIC}$`, 'i') },
      appointment_date: { $gte: dateStart, $lte: dateEnd },
      status: { $in: ['pending', 'confirmed', 'completed'] },
    };

    // For 'both', block if any booking exists for this date
    // For 'pickup', check same type or 'both' (include old records with no service_type)
    // For 'drop', check 'drop' or 'both'
    if (service_type === 'both') {
      // block if any booking exists — no extra filter needed
    } else if (service_type === 'pickup') {
      duplicateFilter.$or = [
        { service_type: 'pickup' },
        { service_type: 'both' },
        { service_type: { $exists: false } }, // old records without service_type = pickup
        { service_type: null },
      ];
    } else {
      // drop
      duplicateFilter.$or = [
        { service_type: 'drop' },
        { service_type: 'both' },
      ];
    }

    const existing = await TransportRequest.findOne(duplicateFilter);

    if (existing) {
      const typeLabel = service_type === 'both' ? 'transport' : service_type;
      return NextResponse.json(
        { error: `You already have a ${typeLabel} request for this appointment date` },
        { status: 409 }
      );
    }

    const transportRequest = await TransportRequest.create({
      ic_number: cleanedIC,
      appointment_id,
      patient_name,
      phone_number,
      doctor_name,
      service_type,
      pickup_station: (service_type === 'pickup' || service_type === 'both') ? pickup_station : undefined,
      appointment_date: new Date(appointment_date),
      appointment_time,
      pickup_time: (service_type === 'pickup' || service_type === 'both') ? pickup_time : undefined,
      dropoff_station: (service_type === 'drop' || service_type === 'both') ? dropoff_station : undefined,
      dropoff_time: (service_type === 'drop' || service_type === 'both') ? dropoff_time : undefined,
      vehicle_id: (service_type === 'pickup' || service_type === 'both') ? vehicle_id : undefined,
      dropoff_vehicle_id: (service_type === 'drop' || service_type === 'both') ? dropoff_vehicle_id : undefined,
      seats: seats || 1,
      transport_required: transport_required ?? true,
      status: 'pending',
    });

    return NextResponse.json({ success: true, data: transportRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Create transport request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
