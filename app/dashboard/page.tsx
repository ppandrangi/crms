// app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Import the useAuth hook
import { useAuth } from '@/app/context/AuthContext';

// Incident interface (assuming it's defined or imported)
interface Incident { id: string; caseNumber: string; reportedAt: string; occurredAt: string; location: string; crimeType: string; description: string; status: string; reportedById: string; reportedBy?: { id: string; name: string; badgeId: string; }; }

// Pagination metadata interface from API
interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
}

// Define allowed sort fields and order types
type SortOrder = 'asc' | 'desc';
type SortField = 'reportedAt' | 'occurredAt' | 'status' | 'crimeType' | 'location' | 'caseNumber'; // Added caseNumber

export default function DashboardPage() {
  const router = useRouter();
  // Use the Auth context
  const { token, isAuthenticated, isLoading: isAuthLoading, logout, userId, badgeId } = useAuth(); // Get token, auth status, loading status, logout function, and user info

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1); // State for current page
  const [limit] = useState<number>(10); // Items per page (could be configurable)
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true); // Separate loading state for data
  const [error, setError] = useState<string | null>(null);

  // --- State for Filters ---
  const [statusFilter, setStatusFilter] = useState<string>(''); // e.g., 'Open', 'Closed', '' for all
  const [searchQuery, setSearchQuery] = useState<string>('');
  // State to trigger refetch when filters are applied via button
  const [appliedFilters, setAppliedFilters] = useState({ status: '', search: '' });
  // -------------------------

  // --- State for Sorting ---
  const [sortBy, setSortBy] = useState<SortField>('reportedAt'); // Default sort field
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // Default sort order
  // -------------------------


  // --- Fetch Incidents Effect (with Pagination, Filtering, Sorting) ---
  // Use useCallback to memoize fetchIncidents
  const fetchIncidents = useCallback(async (page: number, itemsLimit: number, filters: { status: string; search: string }, sort: { by: SortField; order: SortOrder }) => {
    // Ensure authenticated and token available before fetching
    if (!isAuthenticated || !token) {
      console.log("Dashboard Fetch: Not authenticated or no token.");
      // Redirect handled by outer effect, but good practice to check
      return;
    }

    console.log(`Dashboard: Fetching incidents - Page ${page}, Limit ${itemsLimit}, Filters:`, filters, "Sort:", sort);
    setIsLoadingData(true);
    setError(null);

    // Construct query parameters
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', itemsLimit.toString());
    if (filters.status) {
        params.append('status', filters.status);
    }
    if (filters.search && filters.search.trim().length > 0) {
        params.append('searchQuery', filters.search.trim());
    }
    // Add sort parameters
    params.append('sortBy', sort.by);
    params.append('sortOrder', sort.order);

    try {
      // Fetch incidents using the token and constructed params
      const response = await fetch(`/api/incidents?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle unauthorized response (e.g., token expired)
      if (response.status === 401) {
          console.log("Dashboard: Fetch unauthorized, logging out.");
          logout(); // Use context logout which handles redirect
          return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Expect response structure: { incidents: [], pagination: { ... } }
      const data = await response.json();

      if (!data.incidents || !data.pagination) {
          throw new Error("Invalid response structure received from API.");
      }

      setIncidents(data.incidents);
      setPagination(data.pagination); // Store pagination metadata

    } catch (err: any) {
      console.error("Failed to fetch incidents:", err);
      setError(err.message || "An unexpected error occurred while fetching incidents.");
    } finally {
      setIsLoadingData(false);
    }
  // Include necessary dependencies for useCallback
  }, [isAuthenticated, token, logout]); // fetchIncidents depends on auth state

  // Effect to handle initial load and changes in page, filters, or sort
  useEffect(() => {
    // Wait for auth loading to finish before checking authentication
    if (isAuthLoading) {
      console.log("Dashboard: Waiting for auth loading...");
      setIsLoadingData(true); // Keep data loading true while auth loads
      return;
    }

    // If not authenticated after loading, redirect to login
    if (!isAuthenticated) {
      console.log("Dashboard: Not authenticated after auth check, redirecting.");
      // Use replace to avoid adding dashboard to history when redirecting unauthenticated user
      router.replace('/login');
      return;
    }

    // Fetch data whenever currentPage, appliedFilters, sortBy, or sortOrder change
    fetchIncidents(currentPage, limit, appliedFilters, { by: sortBy, order: sortOrder });

  // Add all state values that trigger a refetch to the dependency array
  }, [isAuthenticated, isAuthLoading, currentPage, limit, appliedFilters, sortBy, sortOrder, fetchIncidents, router]);

  // --- Filter Handlers ---
  const handleFilterChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      if (name === 'statusFilter') setStatusFilter(value);
      if (name === 'searchQuery') setSearchQuery(value);
  };

  const applyFilters = () => {
      // Reset to page 1 when applying new filters
      setCurrentPage(1);
      // Update the appliedFilters state to trigger the useEffect hook
      setAppliedFilters({ status: statusFilter, search: searchQuery });
  };

  const clearFilters = () => {
      setStatusFilter('');
      setSearchQuery('');
      setCurrentPage(1);
      setAppliedFilters({ status: '', search: '' }); // Trigger refetch with cleared filters
  };
  // ----------------------

  // --- Sort Handler ---
  const handleSort = (field: SortField) => {
      const newSortOrder = (sortBy === field && sortOrder === 'asc') ? 'desc' : 'asc';
      setSortBy(field);
      setSortOrder(newSortOrder);
      setCurrentPage(1); // Reset to page 1 when sorting changes
      // The useEffect hook watching sortBy and sortOrder will trigger the refetch
  };
  // Helper to render sort indicators
  const renderSortArrow = (field: SortField) => {
      if (sortBy !== field) return null;
      // Use different symbols for visual clarity
      return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };
  // ------------------

  // --- Pagination Handlers --- (remain the same)
  const handlePreviousPage = () => { if (pagination && pagination.currentPage > 1) { setCurrentPage(pagination.currentPage - 1); } };
  const handleNextPage = () => { if (pagination && pagination.currentPage < pagination.totalPages) { setCurrentPage(pagination.currentPage + 1); } };
  // --- Logout Handler --- (remains the same)
  const handleLogout = () => { logout(); };

  // --- Render component ---
  if (isAuthLoading) { /* ... Initializing ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Initializing...</div>; }
  // This state should ideally not be reached if effect redirects properly, but acts as a fallback
  if (!isAuthenticated) { /* ... Redirecting ... */ return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Redirecting to login...</div>; }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold">Incident Dashboard</h1>
            {badgeId && <p className="text-sm text-gray-400">Logged in as: {badgeId}</p>}
        </div>
        <div className="flex space-x-2 flex-wrap">
            <Link href="/incidents/new" legacyBehavior><a className="inline-block px-3 py-2 md:px-4 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 text-sm md:text-base">Report New</a></Link>
            <button onClick={handleLogout} className="px-3 py-2 md:px-4 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500 text-sm md:text-base">Logout</button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
           {/* Status Filter */}
           <div className="flex-grow"> <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-300 mb-1">Status</label> <select id="statusFilter" name="statusFilter" value={statusFilter} onChange={handleFilterChange} className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"> <option value="">All</option> <option value="Open">Open</option> <option value="Under Investigation">Under Investigation</option> <option value="Closed">Closed</option> </select> </div>
           {/* Search Query */}
           <div className="flex-grow"> <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-300 mb-1">Search</label> <input type="text" id="searchQuery" name="searchQuery" value={searchQuery} onChange={handleFilterChange} placeholder="Case#, type, location, desc..." className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/> </div>
           {/* Action Buttons */}
           <div className="flex space-x-2 pt-4 md:pt-0"> <button onClick={applyFilters} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 text-sm">Apply</button> <button onClick={clearFilters} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500 text-sm">Clear</button> </div>
       </div>

      {/* Loading and Error States */}
      {isLoadingData && <div className="text-center py-4">Loading incidents...</div>}
      {error && !isLoadingData && ( /* ... Error display ... */ <div className="text-red-400 p-4 text-center"><p>Error loading incidents: {error}</p><button onClick={() => fetchIncidents(currentPage, limit, appliedFilters, {by: sortBy, order: sortOrder})} className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Retry</button></div> )}

      {/* Incident Table Display */}
      {!isLoadingData && !error && incidents.length === 0 && (<p className="text-center py-4">No incidents found matching your criteria.</p>)}
      {!isLoadingData && !error && incidents.length > 0 && (
          <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700">
                      <tr>
                          {/* Clickable Table Headers for Sorting */}
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('caseNumber')}>Case #{renderSortArrow('caseNumber')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('crimeType')}>Crime Type{renderSortArrow('crimeType')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('status')}>Status{renderSortArrow('status')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('location')}>Location{renderSortArrow('location')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('occurredAt')}>Occurred At{renderSortArrow('occurredAt')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600" onClick={() => handleSort('reportedAt')}>Reported At{renderSortArrow('reportedAt')}</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Reported By</th>
                          <th scope="col" className="relative px-4 py-3"><span className="sr-only">View</span></th>
                      </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {incidents.map((incident) => (
                          <tr key={incident.id} className="hover:bg-gray-700">
                              {/* Table Data Cells */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-400" title={incident.caseNumber}>{incident.caseNumber.substring(0, 8)}...</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">{incident.crimeType}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm"> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${incident.status === 'Open' ? 'bg-yellow-900 text-yellow-300' : incident.status === 'Closed' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>{incident.status}</span></td>
                              <td className="px-4 py-3 text-sm text-gray-300 truncate max-w-xs" title={incident.location}>{incident.location}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{new Date(incident.occurredAt).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{new Date(incident.reportedAt).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{incident.reportedBy?.name ?? 'N/A'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                  <Link href={`/incidents/${incident.id}`} legacyBehavior><a className="text-indigo-400 hover:text-indigo-300">View</a></Link>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* Pagination Controls */}
      {!isLoadingData && pagination && pagination.totalPages > 1 && ( /* ... Pagination controls ... */ <div className="mt-6 flex justify-center items-center space-x-4"><button onClick={handlePreviousPage} disabled={pagination.currentPage <= 1} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">&larr; Previous</button><span className="text-gray-400">Page {pagination.currentPage} of {pagination.totalPages} (Total: {pagination.totalCount})</span><button onClick={handleNextPage} disabled={pagination.currentPage >= pagination.totalPages} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">Next &rarr;</button></div> )}
    </div>
  );
}
