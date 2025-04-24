// app/incidents/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IncidentForm from '@/app/components/IncidentForm'; // Import the updated form
// Import useAuth hook
import { useAuth } from '@/app/context/AuthContext';

// Incident interface
interface Incident { id: string; caseNumber: string; reportedAt: string; occurredAt: string; location: string; crimeType: string; description: string; status: string; reportedById: string; createdAt: string; updatedAt: string; closingReason?: string | null; }

interface EditIncidentPageProps { params: { id: string; }; }

export default function EditIncidentPage({ params }: EditIncidentPageProps) {
  const router = useRouter();
  const { id: incidentId } = params;
  // Use auth context
  const { token, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const [incidentData, setIncidentData] = useState<Incident | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true); // Separate data loading
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch the incident data when the page loads
  useEffect(() => {
     // Wait for auth loading
    if (isAuthLoading) {
        setIsLoadingData(true);
        return;
    }
     // Redirect if not authenticated after loading
    if (!isAuthenticated) {
        console.log("Edit Page: Not authenticated, redirecting.");
        router.replace('/login');
        return;
    }

    const fetchIncidentData = async () => {
      if (!incidentId) { setError("Incident ID missing."); setIsLoadingData(false); return; }
      // Token check primarily relies on isAuthenticated, but good to have as fallback
      if (!token) { setError("Auth token missing."); setIsLoadingData(false); logout(); return; }

      setIsLoadingData(true); setError(null);

      try {
        const response = await fetch(`/api/incidents/${incidentId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });

        if (response.status === 401) { console.log("Edit Page: Fetch unauthorized, logging out."); logout(); return; }
        if (response.status === 404) { throw new Error(`Incident with ID ${incidentId} not found.`); }
        if (!response.ok) { const errorData = await response.json().catch(()=>{}); throw new Error(errorData.message || `HTTP error! status: ${response.status}`); }

        const data: Incident = await response.json();
        setIncidentData(data); // Store fetched data to pass to form

      } catch (err: any) {
        console.error(`Failed to fetch incident ${incidentId} for editing:`, err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoadingData(false);
      }
    };

    // Only fetch if authenticated and incidentId is present
    if (isAuthenticated && incidentId) {
        fetchIncidentData();
    } else if (!isAuthenticated) {
         router.replace('/login'); // Fallback redirect
    }

  }, [incidentId, router, isAuthenticated, token, isAuthLoading, logout]);

  // --- Render component ---
  const combinedIsLoading = isAuthLoading || isLoadingData;

  if (combinedIsLoading) { return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading incident data for editing...</div>; }
  if (!isAuthenticated && !isAuthLoading) { return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Redirecting to login...</div>; } // Handle redirect state
  if (error) { /* ... error loading ... */ return <div className="min-h-screen bg-gray-900 text-red-400 flex flex-col justify-center items-center p-4"><p>Error loading incident data:</p><p className="mt-2 text-sm">{error}</p><Link href={`/incidents/${incidentId}`} legacyBehavior><a className="mt-4 text-indigo-400 hover:text-indigo-300">Back to Incident Details</a></Link></div>; }
  if (!incidentData) { /* ... not found ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Incident data not available.</div>; }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="mb-6">
             <Link href={`/incidents/${incidentId}`} legacyBehavior>
                <a className="text-indigo-400 hover:text-indigo-300">&larr; Cancel Edit / Back to Details</a>
            </Link>
        </div>
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Incident Report</h1>
       <p className="text-center text-sm text-gray-400 mb-6">Case Number: {incidentData.caseNumber}</p>
      <div className="max-w-2xl mx-auto bg-gray-800 p-6 md:p-8 rounded-lg shadow">
        {/* Render the form in edit mode */}
        {/* Pass initialData, incidentId, and isEditMode=true */}
        {/* No need to pass userId for editing */}
        {incidentData && (
             <IncidentForm
                initialData={incidentData}
                incidentId={incidentId}
                isEditMode={true}
             />
        )}
      </div>
       <div className="text-center mt-8 text-xs text-gray-500"> CRMS Mini-Project </div>
    </div>
  );
}
