// app/api/incidents/[id]/evidence/[evidenceId]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { Prisma } from '@prisma/client';

// Define expected params for this specific route
interface RouteParams {
    params: {
        id: string;         // Incident ID from the path
        evidenceId: string; // Evidence ID from the path
    };
}

/**
 * Handles DELETE requests to remove a specific evidence item.
 * Includes authorization: only admin or user who added the evidence can delete.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: incidentId, evidenceId } = params; // Extract both IDs

    // Basic validation of IDs
    if (!incidentId || !evidenceId) {
        return NextResponse.json({ message: "Incident ID and Evidence ID are required." }, { status: 400 });
    }

    // --- Authorization Check ---
    const loggedInUserId = request.headers.get('X-User-Id');
    const isAdminString = request.headers.get('X-User-IsAdmin');
    const isAdmin = isAdminString === 'true';

    console.log(`DELETE /api/incidents/${incidentId}/evidence/${evidenceId} attempt by UserID: ${loggedInUserId}, IsAdmin: ${isAdmin}`);

    if (!loggedInUserId) {
        return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    try {
        // Find the specific evidence item to check ownership
        const evidenceItem = await prisma.evidence.findUnique({
            where: { id: evidenceId },
            select: { addedById: true, incidentId: true } // Select fields needed for checks
        });

        // Check if evidence exists and belongs to the correct incident
        if (!evidenceItem) {
            return NextResponse.json({ message: `Evidence with ID ${evidenceId} not found.` }, { status: 404 });
        }
        if (evidenceItem.incidentId !== incidentId) {
             return NextResponse.json({ message: `Evidence ${evidenceId} does not belong to incident ${incidentId}.` }, { status: 400 });
        }

        // Authorization: Allow if user is admin OR if user added the evidence
        if (!isAdmin && evidenceItem.addedById !== loggedInUserId) {
            console.warn(`DELETE Evidence: Authorization failed! User ${loggedInUserId} tried to delete evidence ${evidenceId} added by ${evidenceItem.addedById}`);
            return NextResponse.json({ message: "Forbidden: You are not authorized to delete this evidence." }, { status: 403 });
        }
        console.log(`DELETE Evidence: Authorization successful for user ${loggedInUserId} on evidence ${evidenceId}.`);
        // --- End Authorization Check ---

        // Perform the delete
        await prisma.evidence.delete({
            where: { id: evidenceId },
        });

        // Return success (No Content)
        return new NextResponse(null, { status: 204 });

    } catch (error: any) {
        console.error(`Failed to delete evidence ${evidenceId}:`, error);
        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') { // Record to delete not found
                 return NextResponse.json({ message: `Evidence with ID ${evidenceId} not found.` }, { status: 404 });
            }
             // Handle potential validation errors if ID format is wrong
             if (error.code === 'P2023') {
                 return NextResponse.json({ message: `Invalid ID format provided.` }, { status: 400 });
             }
        }
         if (error instanceof Prisma.PrismaClientValidationError) {
             return NextResponse.json({ message: `Invalid ID format provided.` }, { status: 400 });
         }
        // Generic error
        return NextResponse.json({ message: "Failed to delete evidence due to an internal server error." }, { status: 500 });
    }
}

