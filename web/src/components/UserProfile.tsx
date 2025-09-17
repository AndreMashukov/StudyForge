import React from 'react';
import { useSignOut } from 'react-firebase-hooks/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const [signOut, loading, error] = useSignOut(auth);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">
            {user.email?.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="text-gray-900 font-semibold">{user.email}</p>
          </div>
        </div>
        
        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-4 0H9m4 0V4a2 2 0 114 0v2"></path>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">User ID</p>
            <p className="text-gray-900 font-mono text-sm break-all">{user.uid.substring(0, 20)}...</p>
          </div>
        </div>
        
        <div className="flex items-center p-3 bg-gray-50 rounded-xl">
          <div className={`w-8 h-8 ${user.emailVerified ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center mr-3`}>
            {user.emailVerified ? (
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email Status</p>
            <p className={`font-semibold ${user.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
              {user.emailVerified ? 'Verified' : 'Not Verified'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center">
          <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
          </svg>
          <div>
            <p className="font-medium">Sign Out Error</p>
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleSignOut}
        disabled={loading}
        className={`w-full py-3 px-4 rounded-xl font-semibold transition duration-200 transform ${
          loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 hover:scale-105 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing Out...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Sign Out
          </div>
        )}
      </button>
    </div>
  );
};