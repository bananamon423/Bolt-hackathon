import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AdminPanel } from '../components/AdminPanel';
import { AuthForm } from '../components/AuthForm';

export function AdminPage() {
  const { user, profile, loading, signIn, signUp } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!loading && profile) {
      if (profile.role !== 'admin') {
        setAccessDenied(true);
      }
    }
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSignIn={signIn} onSignUp={signUp} />;
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-200 rounded-lg p-6 max-w-md">
            <h1 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h1>
            <p className="text-red-600">
              You don't have permission to access the admin panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}