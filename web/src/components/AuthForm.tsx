import React, { useState } from 'react';
import { useSignInWithEmailAndPassword, useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { auth } from '../config/firebase';

export const AuthForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [
    signInWithEmailAndPassword,
    signInUser,
    signInLoading,
    signInError,
  ] = useSignInWithEmailAndPassword(auth);

  const [
    createUserWithEmailAndPassword,
    signUpUser,
    signUpLoading,
    signUpError,
  ] = useCreateUserWithEmailAndPassword(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      await createUserWithEmailAndPassword(email, password);
    } else {
      await signInWithEmailAndPassword(email, password);
    }
  };

  const loading = signInLoading || signUpLoading;
  const error = signInError || signUpError;
  const user = signInUser || signUpUser;

  if (user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl border border-green-100">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">
            Welcome Back!
          </h2>
          <p className="text-green-600 mb-4">
            Successfully signed in as <span className="font-semibold">{user.user.email}</span>
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-green-100 rounded-full text-sm text-green-700">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            Connected to Firebase Auth
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-8 bg-white rounded-2xl shadow-xl border border-gray-100 backdrop-blur-sm">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
          {isSignUp ? 'Create Your Account' : 'Welcome Back'}
        </h2>
        <p className="text-gray-500">
          {isSignUp 
            ? 'Join us to start generating AI-powered quizzes' 
            : 'Sign in to access your quiz dashboard'
          }
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center">
          <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
          </svg>
          <div>
            <p className="font-medium">Authentication Error</p>
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-gray-50 focus:bg-white"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
              </svg>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-gray-50 focus:bg-white"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition duration-200 transform ${
            loading || !email || !password
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : (
            isSignUp ? 'Create Account' : 'Sign In'
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">or</span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-blue-600 hover:text-blue-800 font-semibold transition duration-200"
        >
          {isSignUp 
            ? 'Already have an account? Sign in' 
            : "Don't have an account? Create one"
          }
        </button>
      </div>
    </div>
  );
};