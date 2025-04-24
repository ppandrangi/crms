// app/components/LoginForm.tsx
'use client';

import React, { useState } from 'react';
// Import react-hook-form and resolver
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// Import the Zod schema and inferred type from the shared file
import { LoginSchema, LoginFormData } from '@/app/lib/schemas';

interface LoginFormProps {
  onLoginSuccess: (token: string) => void; // Callback function when API login is successful
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [apiError, setApiError] = useState<string | null>(null); // For errors from the backend API call
  // isLoading state is now managed by react-hook-form's formState.isSubmitting

  // --- React Hook Form Setup ---
  const {
    register, // Function to register inputs
    handleSubmit, // Wraps our submit handler, handles validation first
    formState: { errors, isSubmitting }, // Object containing validation errors and submission status
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema), // Use Zod for validation based on LoginSchema
    mode: 'onChange', // Validate fields as the user types (optional, provides faster feedback)
  });
  // ---------------------------

  // This function runs ONLY if client-side validation passes
  const processLogin: SubmitHandler<LoginFormData> = async (data) => {
    // isLoading state is implicitly true now via isSubmitting
    setApiError(null); // Clear previous API errors

    try {
      // Send validated data to the backend API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), // Send validated data from the form
      });

      // Try to parse the response, even if it's an error response
      const result = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));

      if (!response.ok) {
        // Throw error using message from API response if available
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      // Check if token exists in the successful response
      if (result.token) {
        onLoginSuccess(result.token); // Call the parent component's success handler
      } else {
        // Handle case where API returns 200 OK but no token (shouldn't happen with current backend)
        throw new Error("Login successful according to API, but no token was received.");
      }

    } catch (err: any) {
      // Handle errors from the fetch call or the API logic
      console.error("Login API call failed:", err);
      setApiError(err.message || "An unexpected error occurred during login.");
    }
    // No need for finally { setIsLoading(false) } as isSubmitting handles it
  };

  return (
    // Use handleSubmit from react-hook-form: it validates first, then calls processLogin if valid
    <form onSubmit={handleSubmit(processLogin)} className="space-y-4">
      {/* Display API error message if the backend call fails */}
      {apiError && (
        <div className="p-3 text-red-700 bg-red-100 border border-red-400 rounded">
          Error: {apiError}
        </div>
      )}

      {/* Badge ID Input */}
      <div>
        <label htmlFor="badgeId" className="block text-sm font-medium text-gray-300">
          Badge ID
        </label>
        <input
          type="text"
          id="badgeId"
          // Register input with react-hook-form for validation and state management
          {...register("badgeId")}
          // Apply error styling dynamically
          className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
            errors.badgeId ? 'border-red-500' : 'border-gray-600' // Highlight border on error
          }`}
          placeholder="Enter your badge ID"
          disabled={isSubmitting} // Disable input during form submission
        />
        {/* Display validation error message for badgeId */}
        {errors.badgeId && (
          <p className="mt-1 text-xs text-red-400">{errors.badgeId.message}</p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
          Password
        </label>
        <input
          type="password"
          id="password"
          // Register input
          {...register("password")}
          // Apply error styling dynamically
          className={`mt-1 block w-full px-3 py-2 bg-gray-700 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
            errors.password ? 'border-red-500' : 'border-gray-600'
          }`}
          placeholder="Enter your password"
          disabled={isSubmitting} // Disable input during form submission
        />
         {/* Display validation error message for password */}
        {errors.password && (
          <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting} // Disable button during submission
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </form>
  );
}
