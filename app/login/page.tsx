// app/login/page.tsx
'use client';

import React from 'react';
import LoginForm from '@/app/components/LoginForm';
// Import the useAuth hook
import { useAuth } from '@/app/context/AuthContext';

export default function LoginPage() {
  // Get the login function from the context
  const { login } = useAuth();

  // Pass the context's login function to the LoginForm
  // This function will be called by LoginForm upon successful API call
  const handleLoginSuccess = (token: string) => {
    console.log("Login form submitted successfully, calling context login...");
    login(token); // Use context login function to update state, store token, and redirect
    // No need for sessionStorage or router.push here anymore, the context handles it
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Crime Report Managemt System <br></br> Login
        </h2>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Pass the updated handler */}
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
      <div className="absolute bottom-4 left-0 right-0 px-4 py-2">
        <p className="text-center text-xs text-gray-500">
          Made with ❤️ at Vignan University
        </p>
      </div>
    </div>
  );
}
