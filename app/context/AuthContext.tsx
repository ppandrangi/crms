// app/context/AuthContext.tsx
'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// Using jose for decoding here as well for consistency, though jwt-decode could also work
import * as jose from 'jose';

// Define the structure of the decoded JWT payload
// Ensure this matches the payload created in the login API route
interface DecodedToken extends jose.JWTPayload {
  userId: string;
  badgeId: string;
  isAdmin: boolean; // Added isAdmin
  // iat and exp are standard JWT claims
}

// Define the shape of the context value
interface AuthContextType {
  token: string | null;
  userId: string | null;
  badgeId: string | null;
  isAdmin: boolean | null; // Added isAdmin (can be null initially or if not logged in)
  isAuthenticated: boolean;
  isLoading: boolean; // To handle initial loading of token from storage
  login: (token: string) => void; // Function provided by context to log in
  logout: () => void; // Function provided by context to log out
}

// Create the context with a default value of undefined
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component manages the authentication state
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [badgeId, setBadgeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // Add isAdmin state
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const router = useRouter();

  // Effect to load token from session storage on initial client-side mount
  useEffect(() => {
    setIsLoading(true);
    try {
        const storedToken = sessionStorage.getItem('authToken');
        if (storedToken) {
            // Decode token to check expiration and set user info
            // Using jose.decodeJwt which doesn't verify signature, just reads payload
            const decoded = jose.decodeJwt(storedToken) as DecodedToken;
            const currentTime = Date.now() / 1000; // Current time in seconds

            // Check expiration AND presence of expected fields from our payload
            if (decoded.exp && decoded.exp > currentTime && decoded.userId && decoded.badgeId !== undefined && decoded.isAdmin !== undefined) {
                // Token is valid and payload looks correct, set the state
                setToken(storedToken);
                setUserId(decoded.userId);
                setBadgeId(decoded.badgeId);
                setIsAdmin(decoded.isAdmin); // Set isAdmin state from token
                console.log("AuthContext: Token loaded from storage.", { userId: decoded.userId, isAdmin: decoded.isAdmin });
            } else {
                // Token expired or payload invalid, remove it
                console.log("AuthContext: Stored token expired or invalid payload, removing.");
                sessionStorage.removeItem('authToken');
            }
        }
    } catch (error) {
        // Catch errors during decoding (e.g., malformed token)
        console.error("AuthContext: Error processing stored token:", error);
        sessionStorage.removeItem('authToken'); // Clear potentially invalid token
    } finally {
        setIsLoading(false); // Finished loading attempt
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Login function: updates state and session storage, then redirects
  const login = useCallback((newToken: string) => {
    try {
        // Decode to get payload for setting state
        const decoded = jose.decodeJwt(newToken) as DecodedToken;

        // --- Add Logging Here ---
        // Log the decoded payload BEFORE the check
        console.log('AuthContext: Decoded token in login function:', decoded);
        // ------------------------

        // Basic check if decoding worked and expected fields are present
        if (!decoded || !decoded.userId || decoded.badgeId === undefined || decoded.isAdmin === undefined) {
             // Log the failure reason
             console.error("AuthContext: Decoded token missing required fields.", decoded);
             throw new Error("Invalid token payload received during login.");
        }
        sessionStorage.setItem('authToken', newToken); // Store token
        setToken(newToken);
        setUserId(decoded.userId);
        setBadgeId(decoded.badgeId);
        setIsAdmin(decoded.isAdmin); // Set isAdmin state on login
        console.log("AuthContext: User logged in.", { userId: decoded.userId, isAdmin: decoded.isAdmin });
        router.push('/dashboard'); // Redirect after login
    } catch (error) {
        console.error("AuthContext: Failed to process login token:", error);
        // Clear any potentially bad state if login fails
        sessionStorage.removeItem('authToken');
        setToken(null); setUserId(null); setBadgeId(null); setIsAdmin(null);
        // Optionally, inform the user login failed due to token issue (e.g., set an error state)
    }
  }, [router]); // Include router in dependencies

  // Logout function: clears state and session storage, then redirects
  const logout = useCallback(() => {
    console.log("AuthContext: Logging out.");
    sessionStorage.removeItem('authToken'); // Remove token from storage
    // Reset all auth state
    setToken(null);
    setUserId(null);
    setBadgeId(null);
    setIsAdmin(null); // Clear isAdmin state on logout
    router.push('/login'); // Redirect to login after logout
  }, [router]); // Include router in dependencies

  // Determine authentication status based only on token presence (after initial load)
  const isAuthenticated = !!token;

  // Value provided by the context includes all state and functions
  const value = {
      token,
      userId,
      badgeId,
      isAdmin, // Provide isAdmin status
      isAuthenticated,
      isLoading,
      login,
      logout,
  };

  // Provide the context value to children components
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to easily use the AuthContext in components
// Update hook return type to include isAdmin
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This error means useAuth was called outside of AuthProvider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
