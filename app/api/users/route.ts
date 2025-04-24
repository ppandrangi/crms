// app/api/users/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
// Import Zod
import { z } from 'zod';

const SALT_ROUNDS = 10;

// Define Zod schema for user creation input validation
const CreateUserSchema = z.object({
  badgeId: z.string().trim().min(1, { message: "Badge ID cannot be empty." }),
  name: z.string().trim().min(1, { message: "Name cannot be empty." }),
  // Add password complexity requirements if needed
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
});

/**
 * Handles GET requests to fetch all users (excluding passwords).
 */
export async function GET() {
  // GET handler remains the same
  try {
    const users = await prisma.user.findMany({
      // Explicitly select fields to exclude the password hash
      select: {
        id: true,
        badgeId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { message: "Failed to retrieve users." },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to create a new user.
 * Expects 'badgeId', 'name', and 'password' in the request body.
 * Validates input using Zod.
 * @param request - The incoming NextRequest object.
 * @returns NextResponse - JSON response with the created user (excluding password) or error message.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --- Validate Input using Zod ---
    const validationResult = CreateUserSchema.safeParse(body);
    if (!validationResult.success) {
      // Return detailed validation errors
      return NextResponse.json(
        { message: "Invalid input.", errors: validationResult.error.flatten().fieldErrors },
        { status: 400 } // Bad Request
      );
    }
    // Use validated data from now on
    const { badgeId, name, password } = validationResult.data;
    // --------------------------------

    // Check if user with the same badgeId already exists
    const existingUser = await prisma.user.findUnique({
        where: { badgeId }
    });
    if (existingUser) {
        return NextResponse.json(
            { message: `User with badge ID ${badgeId} already exists.`},
            { status: 409 } // Conflict
        );
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        badgeId,
        name,
        password: hashedPassword, // Store the hashed password
      },
      // Select fields to return, excluding the password hash
      select: {
          id: true,
          badgeId: true,
          name: true,
          createdAt: true,
          updatedAt: true,
      }
    });

    // Return the newly created user data (without password)
    return NextResponse.json(newUser, { status: 201 }); // 201 Created

  } catch (error: any) {
    console.error("Failed to create user:", error);
     // Handle JSON parsing errors specifically
     if (error instanceof SyntaxError) {
        return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
     }
    // Handle potential Prisma-specific errors (e.g., unique constraint violation)
    if (error.code === 'P2002') { // Unique constraint failed
        // This check is slightly redundant due to the explicit check above, but good practice
        return NextResponse.json(
            { message: `Unique constraint violation: A user with this badgeId likely already exists.` },
            { status: 409 } // 409 Conflict
        );
    }
    // Generic error response for other unexpected issues
    return NextResponse.json(
      { message: "Failed to create user." },
      { status: 500 } // Internal Server Error
    );
  }
}
