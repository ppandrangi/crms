// app/api/incidents/[id]/evidence/route.ts // Path uses [id] now
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { z } from 'zod';
// Import the Zod schema for validation
import { EvidenceCreateSchema } from '@/app/lib/schemas';
// Import Prisma types for error handling if needed
import { Prisma } from '@prisma/client';

// Define the expected shape of the parameters passed to the route handlers
// Note: We extract from URL now, but keeping interface structure might be useful conceptually
interface RouteParams {
    params: {
        id: string; // Expect 'id' from the folder structure '[id]'
    };
}

/**
 * Handles GET requests to fetch all evidence for a specific incident.
 * Extracts incident ID from the request URL pathname.
 * @param request - The incoming NextRequest object (used for auth headers & URL).
 * @param params - Object containing route parameters (destructured but value extracted from URL).
 * @returns NextResponse - JSON response with evidence list or error message.
 */
export async function GET(request: NextRequest, { params }: RouteParams) { // Keep signature for consistency, but use URL
    let incidentId: string | undefined;
    try {
        // --- Extract Incident ID from URL ---
        const pathname = request.nextUrl.pathname; // e.g., /api/incidents/cm9pfd.../evidence
        const segments = pathname.split('/');
        // ID should be the second-to-last segment
        incidentId = segments.length >= 3 ? segments[segments.length - 2] : undefined;
        console.log(`GET /api/incidents/[id]/evidence - Extracted incidentId: ${incidentId}`);
        if (!incidentId || incidentId === '[id]') {
             return NextResponse.json({ message: "Incident ID missing or invalid in URL path." }, { status: 400 });
        }
        // -----------------------------------

        // Auth check is implicitly handled by middleware covering /api/incidents/*
        const loggedInUserId = request.headers.get('X-User-Id');
        if (!loggedInUserId) {
            return NextResponse.json({ message: "Authentication required." }, { status: 401 });
        }
        console.log(`GET /api/incidents/${incidentId}/evidence by user ${loggedInUserId}`);


        // Verify the incident exists first (optional but good practice)
        const incidentExists = await prisma.incident.findUnique({
            where: { id: incidentId }, // Use the extracted incidentId
            select: { id: true }
        });
        if (!incidentExists) {
            return NextResponse.json({ message: `Incident with ID ${incidentId} not found.` }, { status: 404 });
        }

        // Fetch evidence related to the incident
        const evidenceList = await prisma.evidence.findMany({
            where: { incidentId: incidentId }, // Filter by the correct incidentId variable
            orderBy: { createdAt: 'asc' }, // Order by creation time
            include: {
                addedBy: { // Include basic info about who added the evidence
                    select: { id: true, name: true, badgeId: true }
                }
            }
        });

        return NextResponse.json(evidenceList);

    } catch (error: any) {
        console.error(`Failed to fetch evidence for incident ${incidentId || 'unknown'}:`, error);
         // Check for Prisma validation error which might indicate ID format issue
         if (error.code === 'P2023' || error instanceof Prisma.PrismaClientValidationError) {
             console.error("Prisma Validation Error likely due to invalid ID format:", error);
             return NextResponse.json({ message: `Invalid Incident ID format: ${incidentId}` }, { status: 400 });
         }
        return NextResponse.json(
            { message: "Failed to retrieve evidence due to an internal server error." },
            { status: 500 }
        );
    }
}


/**
 * Handles POST requests to add a new evidence item to a specific incident.
 * Extracts incident ID from the request URL pathname.
 * @param request - The incoming NextRequest object containing evidence data.
 * @param params - Object containing route parameters (destructured but value extracted from URL).
 * @returns NextResponse - JSON response with the created evidence or error message.
 */
export async function POST(request: NextRequest, { params }: RouteParams) { // Keep signature for consistency
    let incidentId: string | undefined;
    try {
        // --- Extract Incident ID from URL ---
        const pathname = request.nextUrl.pathname;
        const segments = pathname.split('/');
        incidentId = segments.length >= 3 ? segments[segments.length - 2] : undefined;
        console.log(`POST /api/incidents/[id]/evidence - Extracted incidentId: ${incidentId}`);
        if (!incidentId || incidentId === '[id]') {
            return NextResponse.json({ message: "Incident ID missing or invalid in URL path." }, { status: 400 });
        }
        // -----------------------------------

        // Auth check - get user ID added by middleware
        const loggedInUserId = request.headers.get('X-User-Id');
        if (!loggedInUserId) {
            return NextResponse.json({ message: "Authentication required." }, { status: 401 });
        }
        console.log(`POST /api/incidents/${incidentId}/evidence by user ${loggedInUserId}`);


        // Verify the incident exists first
        const incidentExists = await prisma.incident.findUnique({
            where: { id: incidentId }, // Use the extracted incidentId
            select: { id: true }
        });
        if (!incidentExists) {
            return NextResponse.json({ message: `Incident with ID ${incidentId} not found.` }, { status: 404 });
        }

        const body = await request.json();

        // --- Validate Input using Zod ---
        const validationResult = EvidenceCreateSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { message: "Invalid input.", errors: validationResult.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        // Use validated data
        const { description, type, storageReference } = validationResult.data;
        // --------------------------------

        // Create the new evidence record
        const newEvidence = await prisma.evidence.create({
            data: {
                description,
                type,
                storageReference,
                incidentId: incidentId, // Link to the incident using correct variable name
                addedById: loggedInUserId, // Link to the user who added it
            },
             include: { // Include user details in response
                addedBy: { select: { id: true, name: true, badgeId: true } }
            }
        });

        return NextResponse.json(newEvidence, { status: 201 }); // 201 Created

    } catch (error: any) {
        console.error(`Failed to add evidence for incident ${incidentId || 'unknown'}:`, error);
        if (error instanceof SyntaxError) { return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 }); }
        // Check for Prisma validation error which might indicate ID format issue
         if (error.code === 'P2023' || error instanceof Prisma.PrismaClientValidationError) {
             console.error("Prisma Validation Error likely due to invalid ID format:", error);
             return NextResponse.json({ message: `Invalid Incident ID format: ${incidentId}` }, { status: 400 });
         }
        // Handle potential Prisma errors (e.g., foreign key constraint if user/incident deleted concurrently)
        if (error.code === 'P2003') { return NextResponse.json({ message: `Foreign key constraint violation. Ensure incident and user exist.` }, { status: 400 }); }
        return NextResponse.json(
            { message: "Failed to add evidence due to an internal server error." },
            { status: 500 }
        );
    }
}
