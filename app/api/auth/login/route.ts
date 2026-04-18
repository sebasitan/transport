import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Admin } from '@/lib/models';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (admin.lockUntil && admin.lockUntil > new Date()) {
      return NextResponse.json(
        { error: 'Account is locked. Please try again later.' },
        { status: 423 }
      );
    }

    // Compare password with bcrypt
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      // Increment failed attempts
      const failedAttempts = (admin.failedAttempts || 0) + 1;
      const update: any = { failedAttempts };
      if (failedAttempts >= 5) {
        update.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await Admin.updateOne({ _id: admin._id }, update);

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Reset failed attempts and update last login
    await Admin.updateOne(
      { _id: admin._id },
      { failedAttempts: 0, lockUntil: null, lastLogin: new Date() }
    );

    // Generate JWT token
    const token = await signToken({
      id: admin._id.toString(),
      role: 'admin',
      username: admin.username,
    });

    return NextResponse.json({
      success: true,
      token,
      admin: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLogin: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
