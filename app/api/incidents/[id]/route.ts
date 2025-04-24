// app/api/incidents/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { IncidentUpdateSchema } from '@/app/lib/schemas';

// RouteParams interface might not be needed if we don't use the params argument
// interface RouteParams { params: { id: string; }; }

/**
 * Handles GET requests to fetch a single incident by its ID.
 * Extracts ID from the request URL pathname.
 */
export async function GET(request: NextRequest /* Removed { params } argument */) {
  try {
    // --- Extract ID from URL ---
    const pathname = request.nextUrl.pathname; // e.g., /api/incidents/cm9pfd57q005mo70zkilb83x8
    const segments = pathname.split('/');
    const id = segments[segments.length - 1]; // Get the last segment
    console.log(`GET /api/incidents/[id] - Extracted ID: ${id}`);
    if (!id || id === '[id]') { // Basic check
        return NextResponse.json({ message: "Incident ID missing or invalid in URL path." }, { status: 400 });
    }
    // --------------------------

    const incident = await prisma.incident.findUnique({
      where: { id }, // Use the extracted ID
      include: { reportedBy: { select: { id: true, name: true, badgeId: true } } },
    });
    if (!incident) { return NextResponse.json({ message: `Incident with ID ${id} not found.` }, { status: 404 }); }
    return NextResponse.json(incident);

  } catch (error: any) { /* ... error handling ... */ console.error(`Failed to fetch incident:`, error); if (error.code === 'P2023' || error instanceof Prisma.PrismaClientValidationError) { return NextResponse.json({ message: `Invalid Incident ID format provided.` }, { status: 400 }); } return NextResponse.json({ message: "Failed to retrieve incident." }, { status: 500 }); }
}

/**
 * Handles PATCH requests to update an existing incident by ID.
 * Extracts ID from the request URL pathname. Includes authorization check.
 */
export async function PATCH(request: NextRequest /* Removed { params } argument */) {
  try {
    // --- Extract ID from URL ---
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/');
    const id = segments[segments.length - 1];
    console.log(`PATCH /api/incidents/[id] - Extracted ID: ${id}`);
     if (!id || id === '[id]') { return NextResponse.json({ message: "Incident ID missing or invalid in URL path." }, { status: 400 }); }
    // --------------------------

    console.log(`PATCH /api/incidents/${id} received`);
    // --- Authorization Check ---
    const loggedInUserId = request.headers.get('X-User-Id');
    const isAdminString = request.headers.get('X-User-IsAdmin');
    const isAdmin = isAdminString === 'true';
    console.log(`PATCH: Auth check for incident ${id}. UserID: ${loggedInUserId}, IsAdmin: ${isAdmin}`);
    if (!loggedInUserId) { return NextResponse.json({ message: "User ID not found." }, { status: 401 }); }
    const incident = await prisma.incident.findUnique({ where: { id } }); // Use extracted id
    if (!incident) { return NextResponse.json({ message: `Incident ${id} not found.` }, { status: 404 }); }
    console.log(`PATCH: Incident found. Reporter: ${incident.reportedById}. Comparing with User: ${loggedInUserId}, Admin: ${isAdmin}`);
    if (!isAdmin && incident.reportedById !== loggedInUserId) { console.warn(`PATCH: Auth failed! ...`); return NextResponse.json({ message: "Forbidden: Not authorized." }, { status: 403 }); }
    console.log(`PATCH: Auth successful...`);
    // --- End Authorization Check ---

    const body = await request.json();
    const validationResult = IncidentUpdateSchema.safeParse(body);
    if (!validationResult.success) { /* ... validation error ... */ return NextResponse.json({ message: "Invalid input.", errors: validationResult.error.flatten().fieldErrors }, { status: 400 }); }
    const validatedData = validationResult.data;
    const updateData: Prisma.IncidentUpdateInput = { /* ... prepare updateData ... */ ...validatedData, occurredAt: validatedData.occurredAt ? new Date(validatedData.occurredAt) : undefined, closingReason: ('closingReason' in validatedData) ? (validatedData.closingReason === "" ? null : validatedData.closingReason) : undefined, }; if (validatedData.status && validatedData.status !== 'Closed') { updateData.closingReason = null; } Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]); if (Object.keys(updateData).length === 0) { return NextResponse.json({ message: "No valid fields provided for update after processing." }, { status: 400 }); }

    const updatedIncident = await prisma.incident.update({ where: { id }, data: updateData, include: { reportedBy: { select: { id: true, name: true, badgeId: true } } } });
    return NextResponse.json(updatedIncident);

  } catch (error: any) { /* ... error handling ... */ console.error(`Failed to update incident:`, error); if (error instanceof SyntaxError) { return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 }); } if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { return NextResponse.json({ message: `Incident not found.` }, { status: 404 }); } if (error.code === 'P2023' || error instanceof Prisma.PrismaClientValidationError) { return NextResponse.json({ message: `Invalid Incident ID format provided.` }, { status: 400 }); } return NextResponse.json({ message: "Failed to update incident." }, { status: 500 }); }
}

/**
 * Handles DELETE requests to remove an incident by its ID.
 * Extracts ID from the request URL pathname. Includes authorization check.
 */
export async function DELETE(request: NextRequest /* Removed { params } argument */) {
   try {
    // --- Extract ID from URL ---
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/');
    const id = segments[segments.length - 1];
    console.log(`DELETE /api/incidents/[id] - Extracted ID: ${id}`);
     if (!id || id === '[id]') { return NextResponse.json({ message: "Incident ID missing or invalid in URL path." }, { status: 400 }); }
    // --------------------------

    console.log(`DELETE /api/incidents/${id} received`);
    // --- Authorization Check ---
    const loggedInUserId = request.headers.get('X-User-Id');
    const isAdminString = request.headers.get('X-User-IsAdmin');
    const isAdmin = isAdminString === 'true';
    console.log(`DELETE: Auth check for incident ${id}. UserID: ${loggedInUserId}, IsAdmin: ${isAdmin}`);
    if (!loggedInUserId) { return NextResponse.json({ message: "User ID not found." }, { status: 401 }); }
    const incident = await prisma.incident.findUnique({ where: { id } }); // Use extracted id
    if (!incident) { return NextResponse.json({ message: `Incident ${id} not found.` }, { status: 404 }); }
    console.log(`DELETE: Incident found. Reporter: ${incident.reportedById}. Comparing with User: ${loggedInUserId}, Admin: ${isAdmin}`);
    if (!isAdmin && incident.reportedById !== loggedInUserId) { console.warn(`DELETE: Auth failed! ...`); return NextResponse.json({ message: "Forbidden: Not authorized." }, { status: 403 }); }
    console.log(`DELETE: Auth successful...`);
    // --- End Authorization Check ---

    await prisma.incident.delete({ where: { id } }); // Use extracted id
    return new NextResponse(null, { status: 204 });

  } catch (error: any) { /* ... error handling ... */ console.error(`Failed to delete incident:`, error); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') { return NextResponse.json({ message: `Incident not found.` }, { status: 404 }); } if (error.code === 'P2023' || error instanceof Prisma.PrismaClientValidationError) { return NextResponse.json({ message: `Invalid Incident ID format provided.` }, { status: 400 }); } return NextResponse.json({ message: "Failed to delete incident." }, { status: 500 }); }
}
