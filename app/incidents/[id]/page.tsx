// app/incidents/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import Modal from '@/app/components/ui/Modal'; // Import the Modal component

// Interfaces
interface UserInfo { id: string; name: string; badgeId: string; }
interface Incident { id: string; caseNumber: string; reportedAt: string; occurredAt: string; location: string; crimeType: string; description: string; status: string; reportedById: string; reportedBy?: UserInfo; createdAt: string; updatedAt: string; closingReason?: string | null; }
// Added Evidence interface
interface Evidence { id: string; description: string; type: string; storageReference: string; createdAt: string; addedById: string; addedBy?: UserInfo; incidentId: string; }

interface IncidentDetailPageProps { params: { id: string; }; }

export default function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const router = useRouter();
  const { id: incidentId } = params; // Get incident ID from params
  // Use auth context to get user info and token
  const { token, isAuthenticated, isLoading: isAuthLoading, logout, userId, isAdmin } = useAuth();

  // Incident State
  const [incident, setIncident] = useState<Incident | null>(null);
  const [isLoadingIncident, setIsLoadingIncident] = useState<boolean>(true);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  // Evidence State
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState<boolean>(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Add Evidence Form State
  const [showAddEvidenceForm, setShowAddEvidenceForm] = useState<boolean>(false);
  const [newEvidenceDesc, setNewEvidenceDesc] = useState<string>('');
  const [newEvidenceType, setNewEvidenceType] = useState<string>('Other');
  const [newEvidenceStorageRef, setNewEvidenceStorageRef] = useState<string>('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState<boolean>(false);
  const [addEvidenceError, setAddEvidenceError] = useState<string | null>(null);

  // Incident Modal State (for delete/close incident)
  const [isIncidentCloseOperation, setIsIncidentCloseOperation] = useState<boolean>(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState<boolean>(false);
  const [incidentModalReason, setIncidentModalReason] = useState<string>('');
  const [isProcessingIncidentModal, setIsProcessingIncidentModal] = useState<boolean>(false);
  const [incidentModalActionError, setIncidentModalActionError] = useState<string | null>(null);

  // State for Deleting Evidence
  const [isDeleteEvidenceModalOpen, setIsDeleteEvidenceModalOpen] = useState<boolean>(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<Evidence | null>(null); // Store the whole item
  const [isDeletingEvidence, setIsDeletingEvidence] = useState<boolean>(false);
  const [deleteEvidenceError, setDeleteEvidenceError] = useState<string | null>(null);
  // -----------------------------------

  // --- Fetch Incident and Evidence Effect ---
  const fetchData = useCallback(async () => {
      // Ensure required data is available before fetching
      if (isAuthLoading || !isAuthenticated || !incidentId || !token) {
          return; // Exit if auth not ready or required params missing
      }

      // Reset errors and set loading states
      setIncidentError(null);
      setEvidenceError(null);
      setIsLoadingIncident(true);
      setIsLoadingEvidence(true); // Start loading evidence too

      try {
          // Fetch incident and evidence in parallel
          const [incidentResponse, evidenceResponse] = await Promise.all([
              fetch(`/api/incidents/${incidentId}`, {
                  method: 'GET',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              }),
              fetch(`/api/incidents/${incidentId}/evidence`, { // Fetch evidence
                  method: 'GET',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              })
          ]);

          // Process Incident Response
          if (incidentResponse.status === 401 || evidenceResponse.status === 401) {
              console.log("Auth error during fetch, logging out.");
              logout(); // Use context logout
              return;
          }
          if (!incidentResponse.ok) {
              const d = await incidentResponse.json().catch(()=>{ return { message: `Incident fetch failed: ${incidentResponse.statusText || incidentResponse.status}` }});
              throw new Error(d?.message || `Failed to fetch incident: ${incidentResponse.status}`);
          }
          const incidentData: Incident = await incidentResponse.json();
          setIncident(incidentData);

          // Process Evidence Response
          if (!evidenceResponse.ok) {
              const d = await evidenceResponse.json().catch(()=>{ return { message: `Evidence fetch failed: ${evidenceResponse.statusText || evidenceResponse.status}` }});
              throw new Error(d?.message || `Failed to fetch evidence: ${evidenceResponse.status}`);
          }
          const evidenceData: Evidence[] = await evidenceResponse.json();
          setEvidenceList(evidenceData);

      } catch (err: any) {
          console.error("Failed to fetch data:", err);
          // Set a general error, could be more specific
          setIncidentError(err.message || "An unexpected error occurred.");
          setEvidenceList([]); // Clear evidence on error
      } finally {
          setIsLoadingIncident(false);
          setIsLoadingEvidence(false); // Stop loading evidence
      }
  }, [incidentId, token, isAuthenticated, isAuthLoading, logout]); // Dependencies updated

  // Effect to run fetch logic
  useEffect(() => {
      if (isAuthLoading) return; // Wait for auth check
      if (!isAuthenticated) {
          console.log("Detail Page: Not authenticated, redirecting.");
          router.push('/login'); // Redirect if not logged in
          return;
      }
      // Ensure incidentId is valid before fetching
      if(incidentId) {
          fetchData();
      } else {
          console.warn("Detail Page: incidentId is undefined in useEffect.");
          setIncidentError("Incident ID is missing.");
          setIsLoadingIncident(false);
          setIsLoadingEvidence(false);
      }
  // Rerun if auth status changes or incidentId changes
  }, [isAuthLoading, isAuthenticated, fetchData, router, incidentId]);

  // --- Add Evidence Handler ---
  const handleAddEvidenceSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmittingEvidence(true);
      setAddEvidenceError(null);

      if (!token || !userId || !incidentId) { setAddEvidenceError("Not authenticated or incident ID missing."); setIsSubmittingEvidence(false); if(!token || !userId) logout(); return; }
      if (!newEvidenceDesc.trim() || !newEvidenceType.trim() || !newEvidenceStorageRef.trim()) { setAddEvidenceError("All evidence fields are required."); setIsSubmittingEvidence(false); return; }

      const evidencePayload = { description: newEvidenceDesc, type: newEvidenceType, storageReference: newEvidenceStorageRef };

      try {
          const response = await fetch(`/api/incidents/${incidentId}/evidence`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(evidencePayload) });
          const result = await response.json().catch(() => ({})); // Attempt to parse JSON always
          if (!response.ok) { throw new Error(result.message || `Failed to add evidence. Status: ${response.status}`); }

          setEvidenceList(prev => [result, ...prev]); // Add to list locally
          setNewEvidenceDesc(''); setNewEvidenceType('Other'); setNewEvidenceStorageRef(''); // Reset form
          setShowAddEvidenceForm(false); // Hide form
          alert("Evidence added successfully!"); // Simple success feedback

      } catch (err: any) { console.error("Failed to add evidence:", err); setAddEvidenceError(err.message); if (err.message?.includes("Unauthorized")) logout(); }
      finally { setIsSubmittingEvidence(false); }
  };


  // --- Incident Modal Handlers ---
  const openIncidentModal = (isCloseAction: boolean) => { setIsIncidentCloseOperation(isCloseAction); setIncidentModalReason(''); setIncidentModalActionError(null); setIsIncidentModalOpen(true); };
  const handleIncidentModalConfirm = async () => {
      if (!incidentModalReason.trim()) { setIncidentModalActionError("Reason required."); return; }
      setIncidentModalActionError(null); setIsProcessingIncidentModal(true);
      if (!token || !incidentId) { setIncidentModalActionError("Token or Incident ID missing."); setIsProcessingIncidentModal(false); if(!token) logout(); return; }

      try {
          let response: Response;
          if (isIncidentCloseOperation) { // Closing Incident
              response = await fetch(`/api/incidents/${incidentId}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: "Closed", closingReason: incidentModalReason }), });
          } else { // Deleting Incident
              response = await fetch(`/api/incidents/${incidentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          }

          if (response.status === 401) throw new Error("Unauthorized.");
          if (response.status === 403) throw new Error("Forbidden.");
          if (response.status === 404) throw new Error("Incident not found.");
          if (!response.ok && response.status !== 204) { const d = await response.json().catch(() => ({})); throw new Error(d?.message || `Request failed. Status: ${response.status}`); }

          setIsIncidentModalOpen(false); // Close modal on success
          if (isIncidentCloseOperation) {
              const updatedIncidentData: Incident = await response.json();
              setIncident(updatedIncidentData); // Update local state
              alert("Incident closed.");
          } else {
              alert("Incident deleted.");
              router.push('/dashboard'); // Redirect after delete
          }
      } catch (err: any) { console.error(`Incident modal action failed:`, err); setIncidentModalActionError(err.message); if (err.message?.includes("Unauthorized") || err.message?.includes("Forbidden")) logout(); } // Logout on auth/authz errors
      finally { setIsProcessingIncidentModal(false); }
  };

  // --- Evidence Delete Handlers ---
  const openDeleteEvidenceModal = (evidenceItem: Evidence) => {
      setEvidenceToDelete(evidenceItem);
      setDeleteEvidenceError(null); // Clear previous errors
      setIsDeleteEvidenceModalOpen(true); // Open the modal
  };

  const confirmEvidenceDelete = async () => {
      if (!evidenceToDelete || !incidentId || !token) {
          setDeleteEvidenceError("Cannot proceed: Missing evidence ID, incident ID, or token.");
          setIsDeleteEvidenceModalOpen(false); // Close modal if essential info is missing
          if (!token) logout();
          return;
      }

      setIsDeletingEvidence(true);
      setDeleteEvidenceError(null);

      try {
          const response = await fetch(`/api/incidents/${incidentId}/evidence/${evidenceToDelete.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.status === 401) throw new Error("Unauthorized.");
          if (response.status === 403) throw new Error("Forbidden.");
          if (response.status === 404) throw new Error("Evidence not found (already deleted?).");
          if (!response.ok && response.status !== 204) { const d = await response.json().catch(() => ({})); throw new Error(d?.message || `Failed to delete evidence. Status: ${response.status}`); }

          // Success: Remove item from local state and close modal
          setEvidenceList(prev => prev.filter(item => item.id !== evidenceToDelete.id));
          setIsDeleteEvidenceModalOpen(false);
          setEvidenceToDelete(null);
          alert("Evidence deleted successfully."); // Simple feedback

      } catch (err: any) {
          console.error(`Failed to delete evidence ${evidenceToDelete.id}:`, err);
          setDeleteEvidenceError(err.message || "An unexpected error occurred during deletion.");
          // Don't close modal on error, so user sees the error message
          if (err.message?.includes("Unauthorized") || err.message?.includes("Forbidden")) logout();
      } finally {
          setIsDeletingEvidence(false);
      }
  };
  // --------------------------------

  // --- Determine Storage Reference Label/Placeholder ---
  const getStorageRefLabel = () => { /* ... */ switch (newEvidenceType) { case 'Physical Item': return "Locker ID / Bag #"; case 'Photo': case 'Document': case 'Video': case 'Audio': return "File Path / URL"; case 'Statement': case 'Other': default: return "Storage Reference / Notes"; } };
  const getStorageRefPlaceholder = () => { /* ... */ switch (newEvidenceType) { case 'Physical Item': return "e.g., Locker #7, Bag E456"; case 'Photo': return "e.g., /evidence/case123/photo_01.jpg"; case 'Document': return "e.g., /evidence/case123/witness_statement.pdf"; case 'Video': return "e.g., /evidence/case123/cctv_clip.mp4"; case 'Audio': return "e.g., /evidence/case123/recording.mp3"; case 'Statement': return "e.g., Witness statement taken by Officer X"; case 'Other': default: return "Enter reference details"; } };
  // ------------------------------------------------------------

  // --- Render component ---
  if (isLoadingIncident || isAuthLoading) { /* ... loading ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading...</div>; }
  if (!isAuthenticated && !isAuthLoading) { /* ... redirecting ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Redirecting...</div>; }
  if (incidentError) { /* ... error loading incident ... */ return <div className="min-h-screen bg-gray-900 text-red-400 flex flex-col justify-center items-center p-4"><p>Error loading incident:</p><p className="mt-2 text-sm">{incidentError}</p><Link href="/dashboard" legacyBehavior><a className="mt-4 text-indigo-400 hover:text-indigo-300">Back to Dashboard</a></Link></div>; }
  if (!incident) { /* ... not found ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Incident not found.</div>; }

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white p-8">
         {/* Header and Action Buttons */}
         <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
               <Link href="/dashboard" legacyBehavior><a className="text-indigo-400 hover:text-indigo-300">&larr; Back to Dashboard</a></Link>
               <div className="space-x-3">
                   {/* Edit Incident Button */}
                   <Link href={`/incidents/${incidentId}/edit`} legacyBehavior><a className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500 disabled:opacity-50">Edit</a></Link>
                   {/* Close Incident Button */}
                   {incident.status !== 'Closed' && (<button onClick={() => openIncidentModal(true)} disabled={isProcessingIncidentModal} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:opacity-50">Close</button>)}
                   {/* Delete Incident Button */}
                   <button onClick={() => openIncidentModal(false)} disabled={isProcessingIncidentModal} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 disabled:opacity-50">Delete</button>
               </div>
          </div>
        <h1 className="text-3xl font-bold mb-6">Incident Details</h1>
        {/* Display Incident action errors if they occur outside modal */}
        {incidentModalActionError && !isIncidentModalOpen && <div className="mb-4 p-3 text-red-700 bg-red-100 border border-red-400 rounded">Error: {incidentModalActionError}</div>}

        {/* Incident Details Display */}
        <div className="bg-gray-800 p-6 rounded-lg shadow space-y-4 mb-8">
          {/* ... incident details fields ... */}
           <div><strong className="text-gray-400 w-32 inline-block">Case Number:</strong> {incident.caseNumber}</div> <div><strong className="text-gray-400 w-32 inline-block">Crime Type:</strong> {incident.crimeType}</div> <div><strong className="text-gray-400 w-32 inline-block">Status:</strong> <span className={`font-medium ${incident.status === 'Open' ? 'text-yellow-400' : incident.status === 'Closed' ? 'text-green-400' : 'text-blue-400'}`}>{incident.status}</span></div> {incident.status === 'Closed' && incident.closingReason && ( <div><strong className="text-gray-400 w-32 inline-block">Closing Reason:</strong> {incident.closingReason}</div> )} <div><strong className="text-gray-400 w-32 inline-block">Location:</strong> {incident.location}</div> <div><strong className="text-gray-400 w-32 inline-block">Occurred At:</strong> {new Date(incident.occurredAt).toLocaleString()}</div> <div><strong className="text-gray-400 w-32 inline-block">Reported At:</strong> {new Date(incident.reportedAt).toLocaleString()}</div> <div><strong className="text-gray-400 w-32 inline-block">Reported By:</strong> {incident.reportedBy?.name} ({incident.reportedBy?.badgeId})</div> <div className="pt-2"><strong className="text-gray-400 block mb-1">Description:</strong> <p className="whitespace-pre-wrap">{incident.description}</p></div> <div><strong className="text-gray-400 w-32 inline-block">Record ID:</strong> <span className="text-xs font-mono text-gray-500">{incident.id}</span></div> <div><strong className="text-gray-400 w-32 inline-block">Last Updated:</strong> {new Date(incident.updatedAt).toLocaleString()}</div>
        </div>

        {/* --- Evidence Section --- */}
        <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Evidence Log</h2>
            <div className="mb-4 text-right"> <button onClick={() => setShowAddEvidenceForm(!showAddEvidenceForm)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500"> {showAddEvidenceForm ? 'Cancel Adding Evidence' : 'Add New Evidence'} </button> </div>
            {showAddEvidenceForm && ( /* ... Add Evidence Form JSX ... */ <form onSubmit={handleAddEvidenceSubmit} className="p-4 mb-6 bg-gray-700 rounded-lg space-y-3"> <h3 className="text-lg font-semibold mb-2">Add Evidence Details</h3> {addEvidenceError && <p className="text-red-400 text-sm">Error: {addEvidenceError}</p>} <div> <label htmlFor="evidenceDesc" className="block text-sm font-medium text-gray-300">Description</label> <textarea id="evidenceDesc" rows={2} value={newEvidenceDesc} onChange={(e) => setNewEvidenceDesc(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" /> </div> <div> <label htmlFor="evidenceType" className="block text-sm font-medium text-gray-300">Type</label> <select id="evidenceType" value={newEvidenceType} onChange={(e) => setNewEvidenceType(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"> <option>Photo</option> <option>Document</option> <option>Physical Item</option> <option>Statement</option> <option>Video</option> <option>Audio</option> <option>Other</option> </select> </div> <div> <label htmlFor="evidenceStorage" className="block text-sm font-medium text-gray-300">{getStorageRefLabel()}</label> {['Photo', 'Document', 'Video', 'Audio'].includes(newEvidenceType) ? ( <input type="text" id="evidenceStorage" value={newEvidenceStorageRef} onChange={(e) => setNewEvidenceStorageRef(e.target.value)} required placeholder={getStorageRefPlaceholder()} className="mt-1 block w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50" /> ) : ( <input type="text" id="evidenceStorage" value={newEvidenceStorageRef} onChange={(e) => setNewEvidenceStorageRef(e.target.value)} required placeholder={getStorageRefPlaceholder()} className="mt-1 block w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" /> )} </div> <div className="text-right"> <button type="submit" disabled={isSubmittingEvidence} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"> {isSubmittingEvidence ? 'Adding...' : 'Add Evidence'} </button> </div> </form> )}
            {/* Evidence List */}
            {isLoadingEvidence && <p>Loading evidence...</p>}
            {evidenceError && !isLoadingEvidence && <p className="text-red-400">Error loading evidence: {evidenceError}</p>}
            {!isLoadingEvidence && !evidenceError && evidenceList.length === 0 && (<p className="text-gray-400">No evidence logged for this incident.</p>)}
            {!isLoadingEvidence && !evidenceError && evidenceList.length > 0 && (
                <ul className="space-y-3">
                    {evidenceList.map(item => (
                        <li key={item.id} className="p-3 bg-gray-700 rounded flex justify-between items-start gap-2">
                            {/* Evidence Details */}
                            <div className="flex-grow">
                                <p className="font-medium">{item.description}</p>
                                <p className="text-sm text-gray-400"> Type: <span className="font-semibold text-gray-300">{item.type}</span> | Ref: <span className="font-semibold text-gray-300">{item.storageReference}</span> </p>
                                <p className="text-xs text-gray-500 mt-1"> Added by {item.addedBy?.name ?? 'N/A'} ({item.addedBy?.badgeId ?? 'N/A'}) on {new Date(item.createdAt).toLocaleString()} </p>
                            </div>
                             {/* Add Delete Button for Evidence */}
                             {/* Check if user is admin or the user who added the evidence */}
                            {(isAdmin || item.addedById === userId) && (
                                <button
                                    onClick={() => openDeleteEvidenceModal(item)}
                                    disabled={isDeletingEvidence} // Disable while any evidence delete is processing
                                    title="Delete Evidence"
                                    className="ml-4 px-2 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600 disabled:opacity-50 flex-shrink-0" // Added flex-shrink-0
                                >
                                    Delete
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
             )}
        </div>
        {/* --- End Evidence Section --- */}
      </div>

      {/* Modal for Incident Close/Delete */}
      <Modal isOpen={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} onConfirm={handleIncidentModalConfirm} title={isIncidentCloseOperation ? "Confirm Incident Closure" : "Confirm Incident Deletion"} confirmText={isIncidentCloseOperation ? "Confirm Close" : "Confirm Delete"} isConfirmDisabled={isProcessingIncidentModal || !incidentModalReason.trim()}>
          <p className="mb-4 text-sm text-gray-300">{isIncidentCloseOperation ? "Reason for closing?" : "Reason for deleting?"}</p>
          <label htmlFor="modalReason" className="block text-sm font-medium text-gray-400 mb-1">Reason:</label>
          <textarea id="modalReason" rows={3} value={incidentModalReason} onChange={(e) => setIncidentModalReason(e.target.value)} className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter reason here..." />
          {incidentModalActionError && <p className="mt-3 text-xs text-red-400">Error: {incidentModalActionError}</p>}
      </Modal>

       {/* Modal for Evidence Delete Confirmation */}
       <Modal
            isOpen={isDeleteEvidenceModalOpen}
            onClose={() => setIsDeleteEvidenceModalOpen(false)} // Allow closing without confirming
            onConfirm={confirmEvidenceDelete} // Call delete handler on confirm
            title="Confirm Evidence Deletion"
            confirmText="Confirm Delete"
            isConfirmDisabled={isDeletingEvidence} // Disable confirm while processing
        >
            <p className="mb-4 text-sm text-gray-300">
                Are you sure you want to delete this evidence item? This action cannot be undone.
            </p>
            {/* Optionally display details of item being deleted */}
            {evidenceToDelete && (
                 <div className="p-2 border border-gray-600 rounded bg-gray-900 text-xs mb-4">
                    <p><strong>Desc:</strong> {evidenceToDelete.description}</p>
                    <p><strong>Type:</strong> {evidenceToDelete.type}</p>
                    <p><strong>Ref:</strong> {evidenceToDelete.storageReference}</p>
                 </div>
            )}
            {/* Display errors specific to the evidence delete action */}
            {deleteEvidenceError && <p className="mt-3 text-xs text-red-400">Error: {deleteEvidenceError}</p>}
        </Modal>
    </>
  );
}
