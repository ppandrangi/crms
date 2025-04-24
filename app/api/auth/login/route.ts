// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { z } from 'zod';
import { LoginSchema } from '@/app/lib/schemas';

const SALT_ROUNDS = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = LoginSchema.safeParse(body);
    if (!validationResult.success) { /* ... validation error ... */ return NextResponse.json({ message: "Invalid input.", errors: validationResult.error.flatten().fieldErrors }, { status: 400 }); }
    const { badgeId, password } = validationResult.data;

    // Fetch user including the isAdmin field
    const user = await prisma.user.findUnique({ where: { badgeId } });

    // --- Add Logging Here ---
    // Log the entire user object fetched from the database
    console.log('Login API: Fetched user data from DB:', user);
    // ------------------------

    // Check if user exists and if the provided password matches the stored hash
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) { /* ... handle missing secret ... */ return NextResponse.json({ message: "Authentication configuration error." }, { status: 500 }); }
    const secretKey = new TextEncoder().encode(secret);

    // Define the payload
    const payload = {
      userId: user.id,
      badgeId: user.badgeId,
      // Use nullish coalescing just in case isAdmin is unexpectedly null/undefined from DB fetch
      isAdmin: user.isAdmin ?? false
    };

    console.log('Login API: Signing JWT Payload:', payload); // Keep this log too

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    return NextResponse.json({ token });

  } catch (error: any) { /* ... error handling ... */ console.error("Login error:", error); if (error instanceof SyntaxError) { return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 }); } return NextResponse.json({ message: "An unexpected error occurred during login." }, { status: 500 }); }
}
