// app/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma client instance.
// This helps prevent creating multiple instances during development hot-reloading.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Initialize PrismaClient.
// In development, reuse the existing instance if available (attached to 'globalThis').
// In production, always create a new instance.
export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    // Optional: Enable logging for debugging database queries
    // log: ['query', 'info', 'warn', 'error'],
  });

// If in development, assign the new instance to the global variable.
// This prevents exhausting database connections during hot reloads.
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Export the initialized Prisma client instance for use in API routes, etc.
export default prisma;
