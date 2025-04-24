// app/api/incidents/route.ts
import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Zod schema for incident creation (remains the same)
const IncidentCreateSchema = z.object({ /* ... schema ... */ occurredAt: z.string().datetime({ message: "Invalid datetime string. Must be ISO 8601 format." }).min(1, "Occurred At date is required."), location: z.string().trim().min(1, { message: "Location cannot be empty." }), crimeType: z.string().trim().min(1, { message: "Crime Type cannot be empty." }), description: z.string().trim().min(1, { message: "Description cannot be empty." }), reportedById: z.string().cuid({ message: "Invalid reporting user ID format." }), status: z.enum(['Open', 'Under Investigation', 'Closed']).optional(), });

// Define allowed sort fields to prevent arbitrary sorting
const allowedSortByFields = ['reportedAt', 'occurredAt', 'status', 'crimeType', 'location'];

/**
 * Handles GET requests to fetch incidents with pagination, filtering, and sorting.
 * Accepts 'page', 'limit', 'status', 'searchQuery', 'sortBy', 'sortOrder'.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // --- Pagination ---
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, Math.min(50, limit));
    const skip = (validatedPage - 1) * validatedLimit;

    // --- Filtering ---
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('searchQuery');
    const whereClause: Prisma.IncidentWhereInput = {};
    if (statusFilter && ['Open', 'Under Investigation', 'Closed'].includes(statusFilter)) { whereClause.status = statusFilter; }
    if (searchQuery && searchQuery.trim().length > 0) { whereClause.OR = [ { caseNumber: { contains: searchQuery, mode: 'insensitive' } }, { crimeType: { contains: searchQuery, mode: 'insensitive' } }, { location: { contains: searchQuery, mode: 'insensitive' } }, { description: { contains: searchQuery, mode: 'insensitive' } }, ]; }

    // --- Sorting ---
    const sortBy = searchParams.get('sortBy') || 'reportedAt'; // Default sort
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // Default order
    let orderByClause: Prisma.IncidentOrderByWithRelationInput = { reportedAt: 'desc' }; // Default

    // Validate sortBy field and sortOrder
    if (allowedSortByFields.includes(sortBy) && ['asc', 'desc'].includes(sortOrder)) {
        orderByClause = { [sortBy]: sortOrder as Prisma.SortOrder };
    }
    // -----------------

    // --- Fetch Data and Total Count (with WHERE and ORDER BY) ---
    const [incidents, totalCount] = await prisma.$transaction([
      prisma.incident.findMany({
        where: whereClause,
        skip: skip,
        take: validatedLimit,
        orderBy: orderByClause, // Apply the sort clause
        include: { reportedBy: { select: { id: true, name: true, badgeId: true } } }
      }),
      prisma.incident.count({ where: whereClause })
    ]);
    // ----------------------------------------------------------

    const totalPages = Math.ceil(totalCount / validatedLimit);

    return NextResponse.json({
        incidents,
        pagination: { currentPage: validatedPage, totalPages, totalCount, limit: validatedLimit }
    });

  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    return NextResponse.json({ message: "Failed to retrieve incidents." }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new incident.
 */
export async function POST(request: Request) {
  // ... (POST handler remains the same) ...
  try {
    const body = await request.json();
    const validationResult = IncidentCreateSchema.safeParse(body);
    if (!validationResult.success) { return NextResponse.json({ message: "Invalid input.", errors: validationResult.error.flatten().fieldErrors }, { status: 400 }); }
    const { occurredAt, location, crimeType, description, reportedById, status } = validationResult.data;
    const reportingUser = await prisma.user.findUnique({ where: { id: reportedById } });
    if (!reportingUser) { return NextResponse.json({ message: `Reporting user with ID ${reportedById} not found or invalid.` }, { status: 400 }); }
    const newIncident = await prisma.incident.create({
      data: { occurredAt: new Date(occurredAt), location, crimeType, description, reportedById, status: status || 'Open', },
      include: { reportedBy: { select: { id: true, name: true, badgeId: true } } }
    });
    return NextResponse.json(newIncident, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create incident:", error);
    if (error instanceof SyntaxError) { return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 }); }
    if (error.code === 'P2002') { return NextResponse.json({ message: `Unique constraint violation: ${error.meta?.target}` }, { status: 409 }); }
    if (error.code === 'P2003') { return NextResponse.json({ message: `Foreign key constraint violation: ${error.meta?.field_name}` }, { status: 400 }); }
    return NextResponse.json({ message: "Failed to create incident." }, { status: 500 });
  }
}
