import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TransportRequest, Vehicle, TransportSchedule } from '@/lib/models';

// PUT - Assign vehicle and pickup/dropoff time to a request
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { request_id, vehicle_id, pickup_time, dropoff_vehicle_id, dropoff_time } = await request.json();

    if (!request_id || !vehicle_id) {
      return NextResponse.json(
        { error: 'request_id and vehicle_id are required' },
        { status: 400 }
      );
    }

    const transportRequest = await TransportRequest.findById(request_id);
    if (!transportRequest) {
      return NextResponse.json({ error: 'Transport request not found' }, { status: 404 });
    }

    const vehicle = await Vehicle.findById(vehicle_id).populate('driver_id');
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Update transport request
    transportRequest.vehicle_id = vehicle_id;
    if (pickup_time) transportRequest.pickup_time = pickup_time;
    if (dropoff_time) transportRequest.dropoff_time = dropoff_time;
    if (dropoff_vehicle_id) transportRequest.dropoff_vehicle_id = dropoff_vehicle_id;
    transportRequest.status = 'confirmed';
    await transportRequest.save();

    // Create or update transport schedule
    const driver = vehicle.driver_id as any;
    const scheduleData: any = {
      request_id,
      vehicle_id,
      pickup_time: pickup_time || transportRequest.pickup_time,
      dropoff_time: dropoff_time || transportRequest.dropoff_time,
      service_type: transportRequest.service_type || 'pickup',
      driver_name: driver?.name || '',
      driver_phone: driver?.phone || '',
      status: 'confirmed',
    };

    await TransportSchedule.findOneAndUpdate(
      { request_id },
      scheduleData,
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: transportRequest });
  } catch (error: any) {
    console.error('Assign vehicle error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
