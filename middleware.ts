// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Import jose for JWT verification
import * as jose from 'jose';

// Note: Removed 'export const runtime = 'nodejs';' as jose is runtime-agnostic

// Define the structure of the JWT payload we expect
// (Ensure this matches the payload structure set during signing in login route)
interface TokenPayload extends jose.JWTPayload {
  userId: string;
  badgeId: string;
  isAdmin: boolean; // Added isAdmin
  // iat and exp are standard claims handled by jose.JWTPayload
}

// Retrieve the JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
let secretKey: Uint8Array | undefined; // Keep encoded key cached if possible

export async function middleware(request: NextRequest) {
  // Encode the secret only once if not already done
  // This simple caching assumes the env variable doesn't change during runtime
  // For more robust scenarios, consider a more sophisticated approach
  if (!secretKey && JWT_SECRET) {
      try {
          secretKey = new TextEncoder().encode(JWT_SECRET);
      } catch (err) {
          console.error("Failed to encode JWT_SECRET:", err);
          // Handle error appropriately, maybe return 500
      }
  }

  // Clone the request headers to allow modification
  const requestHeaders = new Headers(request.headers);

  // Check for the Authorization header
  const authHeader = requestHeaders.get('Authorization');
  let token: string | undefined;

  // Extract the token if the header exists and follows the Bearer scheme
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  // If no token is found, return an unauthorized response
  if (!token) {
    return new NextResponse(
      JSON.stringify({ message: 'Authentication required.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Ensure the secret key is available (derived from JWT_SECRET)
  if (!secretKey) {
      console.error("JWT_SECRET is not configured or failed to encode.");
      return new NextResponse(
          JSON.stringify({ message: 'Internal server configuration error.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
  }

  try {
    // Verify the token using jose.jwtVerify
    const { payload } = await jose.jwtVerify<TokenPayload>(
        token,
        secretKey,
        { algorithms: ['HS256'] } // Specify expected algorithms
    );

    // Token is valid, 'payload' contains the decoded data

    // --- Add Logging Here ---
    console.log(`Middleware: Verified Token for userId: ${payload.userId}, badgeId: ${payload.badgeId}, isAdmin: ${payload.isAdmin}`);
    // ------------------------


    // Optional: Attach decoded user info to the request headers
    // This allows API routes to access user info without re-verifying the token
    // Note: Headers must be strings
    requestHeaders.set('X-User-Id', payload.userId);
    requestHeaders.set('X-User-BadgeId', payload.badgeId);
    // Pass isAdmin status as a string header
    requestHeaders.set('X-User-IsAdmin', String(payload.isAdmin)); // Convert boolean to string


    // Allow the request to proceed, passing the modified headers
    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

  } catch (error: any) {
    // Handle errors during token verification
    console.error("JWT Verification Error in Middleware:", error);
    let message = 'Invalid or expired token.';

    // Check for specific jose error codes
    // Ref: https://github.com/panva/jose/blob/main/docs/modules/util_errors.md#class-joseerror
    if (error.code === 'ERR_JWT_EXPIRED') {
        message = 'Token has expired.';
    } else if (error.code?.startsWith('ERR_JWT')) { // Covers various JWT errors like signature mismatch, malformed
        message = 'Invalid token (verification failed).';
    } else if (error.code === 'ERR_JOSE_GENERIC') { // Other jose errors
        message = 'Token processing failed.';
    }
    // Add more specific error handling if needed

    return new NextResponse(
      JSON.stringify({ message }),
      { status: 401, headers: { 'Content-Type': 'application/json' } } // Unauthorized
    );
  }
}

// --- Configuration: Specify which paths the middleware should run on ---
// This config remains the same
export const config = {
  matcher: [
    // Protect incident creation
    '/api/incidents', // Apply only to specific methods below (implicitly POST)

    // Protect specific incident modification/deletion
    '/api/incidents/:id*', // Apply only to specific methods below (implicitly PATCH, DELETE)

    // Add other paths to protect here
    // Example: '/api/users/:id*' // If you want to protect user updates/deletes
  ],
};
