// app/incidents/new/page.tsx
'use client';

import React, { useEffect } from 'react';
import IncidentForm from '@/app/components/IncidentForm';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import useAuth hook
import { useAuth } from '@/app/context/AuthContext';

export default function NewIncidentPage() {
    const router = useRouter();
    // Use auth context
    const { isAuthenticated, isLoading: isAuthLoading, userId } = useAuth(); // Get userId from context

    // Effect to check authentication status on load
    useEffect(() => {
        // Wait for auth context to finish loading
        if (isAuthLoading) return;

        // If not authenticated after checking, redirect to login
        if (!isAuthenticated) {
            console.log("New Incident Page: Not authenticated, redirecting.");
            router.replace('/login'); // Use replace to avoid adding this page to history
        }
    }, [isAuthenticated, isAuthLoading, router]);

    // Show loading state while auth is being checked
    if (isAuthLoading) {
         return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Checking authentication...</div>;
    }

    // If definitely not authenticated (e.g., state updated after initial check), prevent rendering form
    // This state also prevents rendering briefly before the redirect effect kicks in
    if (!isAuthenticated) {
         return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Redirecting to login...</div>;
    }

    // Render the form only if authenticated
    // We pass the userId from context to the form now
    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="mb-6">
                 <Link href="/dashboard" legacyBehavior>
                    <a className="text-indigo-400 hover:text-indigo-300">&larr; Back to Dashboard</a>
                </Link>
            </div>

            <h1 className="text-3xl font-bold mb-6 text-center">Report New Incident</h1>

            <div className="max-w-2xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow">
                {/* Pass userId needed for creating incident */}
                {/* Ensure userId is not null before rendering */}
                {userId ? (
                     <IncidentForm isEditMode={false} userId={userId} />
                ) : (
                    // Display loading or error if userId is somehow null while authenticated
                    <p className="text-center text-red-400">Error: User ID not available.</p>
                )}
            </div>
            {/* Optional Footer */}
            <div className="text-center mt-8 text-xs text-gray-500">
                CRMS Mini-Project
            </div>
        </div>
    );
}
