// app/components/IncidentForm.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
// Import useAuth hook
import { useAuth } from '@/app/context/AuthContext';
// Import react-hook-form and resolver
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// Import Zod schemas and types
import { IncidentCreateSchema, IncidentUpdateSchema, IncidentFormData, IncidentUpdateFormData } from '@/app/lib/schemas';

// Use a base interface for props, specific data might differ slightly
interface IncidentBaseData {
  occurredAt: string;
  location: string;
  crimeType: string;
  description: string;
  status: string;
  closingReason?: string | null;
}
// Interface for the data structure when editing (might include ID)
interface IncidentEditData extends IncidentBaseData {
    id?: string;
}


// Props for the component
interface IncidentFormProps {
  initialData?: IncidentEditData | null; // Optional data for editing
  incidentId?: string | null; // ID for editing
  isEditMode?: boolean; // Explicit flag for mode
  userId?: string | null; // Pass userId explicitly for creation mode from parent page
}

// Determine the correct schema and type based on mode
// Note: We use IncidentFormData as the base type for useForm,
// as IncidentUpdateFormData is a subset and Zod handles optional fields.
type CurrentFormData = IncidentFormData; // Base type covers create/edit fields

export default function IncidentForm({ initialData = null, incidentId = null, isEditMode = false, userId: userIdProp }: IncidentFormProps) {
  const router = useRouter();
  // Use auth context to get token and auth status
  const { token, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null); // For errors from the backend API call
  const [success, setSuccess] = useState<string | null>(null);
  // isLoading state is managed by react-hook-form's formState.isSubmitting

  // --- React Hook Form Setup ---
  // Choose the correct Zod schema based on the mode for the resolver
  const currentSchema = isEditMode ? IncidentUpdateSchema : IncidentCreateSchema;

  const {
    register,
    handleSubmit,
    reset, // Function to reset form state
    setValue, // Function to programmatically set field values (less needed now with reset)
    watch, // Function to watch field values (useful for conditional rendering like closingReason)
    formState: { errors, isSubmitting }, // Get errors and submitting state
  } = useForm<CurrentFormData>({
    resolver: zodResolver(currentSchema),
    // Set default values for the form fields
    defaultValues: {
        occurredAt: '',
        location: '',
        crimeType: '',
        description: '',
        status: 'Open',
        closingReason: '',
        // We don't include reportedById in form defaults
    },
    mode: 'onChange', // Validate on change
  });
  // ---------------------------

  // Watch the status field to conditionally show/hide closingReason
  const watchedStatus = watch("status");

  // Effect to populate form when initialData is provided (for edit mode)
   useEffect(() => {
    if (isEditMode && initialData) {
      // Helper function to format ISO date string for datetime-local input
      const formatDateForInput = (dateString: string | Date): string => {
          if (!dateString) return '';
          try {
              const date = new Date(dateString);
              if (isNaN(date.getTime())) { console.warn("Invalid date string:", dateString); return ''; }
              // Format to YYYY-MM-DDTHH:mm required by datetime-local
              const year = date.getFullYear();
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const day = date.getDate().toString().padStart(2, '0');
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              return `${year}-${month}-${day}T${hours}:${minutes}`;
          } catch (e) { console.error("Error formatting date:", e); return ''; }
      };

      // Use reset to update all form values based on initialData
      reset({
        occurredAt: formatDateForInput(initialData.occurredAt),
        location: initialData.location || '',
        crimeType: initialData.crimeType || '',
        description: initialData.description || '',
        status: initialData.status || 'Open',
        closingReason: initialData.closingReason || '',
      });
    } else if (!isEditMode) {
      // Optionally reset form to defaults when switching to create mode
      // if the component instance is reused (depends on parent structure)
       reset({ occurredAt: '', location: '', crimeType: '', description: '', status: 'Open', closingReason: '' });
    }
  }, [initialData, isEditMode, reset]); // Depend on initialData, isEditMode, and reset function


  // Submit handler - runs only after client-side validation passes
  const processSubmit: SubmitHandler<CurrentFormData> = async (data) => {
    setApiError(null); setSuccess(null);
    if (isAuthLoading) { setApiError("Auth loading..."); return; }
    if (!isAuthenticated || !token) { setApiError("Not authenticated."); logout(); return; }

    // Prepare payload - use validated 'data' object from react-hook-form
    let occurredAtISO = '';
    try { occurredAtISO = new Date(data.occurredAt).toISOString(); }
    catch (e) { setApiError("Invalid 'Occurred At' date format."); return; }

    // Base payload for both create and update, using validated data
    const basePayload = {
      ...data, // Spread validated data
      occurredAt: occurredAtISO, // Use converted date
      // Ensure closingReason is null if status isn't Closed or if it's empty/null
      closingReason: data.status === 'Closed' ? (data.closingReason || null) : null,
    };

    // Add reportedById only for creation payload
    const incidentPayload = isEditMode ? basePayload : { ...basePayload, reportedById: userIdProp as string };

    // Check userIdProp for create mode again
    if (!isEditMode && !incidentPayload.reportedById) {
        setApiError("Could not determine reporting user ID."); logout(); return;
    }

    const apiUrl = isEditMode ? `/api/incidents/${incidentId}` : '/api/incidents';
    const apiMethod = isEditMode ? 'PATCH' : 'POST';

    // Make API call
    try {
      const response = await fetch(apiUrl, {
        method: apiMethod,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentPayload),
      });
      const result = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
      if (!response.ok) { throw new Error(result.message || `HTTP error! status: ${response.status}`); }

      setSuccess(isEditMode ? 'Incident updated successfully!' : `Incident reported successfully! Case Number: ${result.caseNumber}`);
      // Redirect after a delay
      setTimeout(() => {
          if (isEditMode && incidentId) { router.push(`/incidents/${incidentId}`); } // Go back to detail page after edit
          else { router.push('/dashboard'); } // Go to dashboard after create
      }, 1500);

    } catch (err: any) {
      console.error(`Failed to ${isEditMode ? 'update' : 'report'} incident:`, err);
      setApiError(err.message || "An unexpected error occurred.");
       if (err.message?.includes("Unauthorized") || err.message?.includes("token") || err.message?.includes("401")) {
            logout(); // Logout on auth errors
       }
    }
    // isSubmitting state is automatically handled by react-hook-form
  };

  // --- Render Form ---
   if (isAuthLoading) {
     return <div className="text-center text-gray-400">Loading authentication...</div>;
   }

  return (
    // Use handleSubmit from react-hook-form
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4">
      {apiError && <div className="p-3 text-red-700 bg-red-100 border border-red-400 rounded">Error: {apiError}</div>}
      {success && <div className="p-3 text-green-700 bg-green-100 border border-green-400 rounded">{success}</div>}

      {/* Occurred At Input */}
      <div>
        <label htmlFor="occurredAt" className="block text-sm font-medium text-gray-300">Occurred At</label>
        <input type="datetime-local" id="occurredAt" {...register("occurredAt")} required className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.occurredAt ? 'border-red-500' : 'border-gray-600'}`} disabled={isSubmitting} />
        {errors.occurredAt && <p className="mt-1 text-xs text-red-400">{errors.occurredAt.message}</p>}
      </div>

      {/* Location Input */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-300">Location</label>
        <input type="text" id="location" {...register("location")} required className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.location ? 'border-red-500' : 'border-gray-600'}`} placeholder="e.g., Near Main Gate" disabled={isSubmitting} />
        {errors.location && <p className="mt-1 text-xs text-red-400">{errors.location.message}</p>}
      </div>

      {/* Crime Type Input */}
      <div>
        <label htmlFor="crimeType" className="block text-sm font-medium text-gray-300">Crime Type</label>
        <input type="text" id="crimeType" {...register("crimeType")} required className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.crimeType ? 'border-red-500' : 'border-gray-600'}`} placeholder="e.g., Theft, Vandalism" disabled={isSubmitting} />
        {errors.crimeType && <p className="mt-1 text-xs text-red-400">{errors.crimeType.message}</p>}
      </div>

      {/* Description Input */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300">Description</label>
        <textarea id="description" rows={4} {...register("description")} required className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.description ? 'border-red-500' : 'border-gray-600'}`} placeholder="Provide details about the incident..." disabled={isSubmitting} />
        {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>}
      </div>

      {/* Status Input */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-300">Status</label>
        <select id="status" {...register("status")} required className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.status ? 'border-red-500' : 'border-gray-600'}`} disabled={isSubmitting}>
            <option value="Open">Open</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Closed">Closed</option>
        </select>
         {errors.status && <p className="mt-1 text-xs text-red-400">{errors.status.message}</p>}
      </div>

      {/* Closing Reason Input - Conditionally rendered based on watched status value */}
      {watchedStatus === 'Closed' && (
          <div>
            <label htmlFor="closingReason" className="block text-sm font-medium text-gray-300">Closing Reason</label>
            {/* Register closingReason */}
            <textarea id="closingReason" rows={2} {...register("closingReason")} className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.closingReason ? 'border-red-500' : 'border-gray-600'}`} placeholder="Reason for closing (if status is Closed)" disabled={isSubmitting} />
            {errors.closingReason && <p className="mt-1 text-xs text-red-400">{errors.closingReason.message}</p>}
          </div>
      )}

      {/* Submit Button */}
      <div>
        <button type="submit" disabled={isSubmitting || isAuthLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
          {isSubmitting ? (isEditMode ? 'Saving Changes...' : 'Submitting...') : (isEditMode ? 'Save Changes' : 'Submit Incident Report')}
        </button>
      </div>
    </form>
  );
}
