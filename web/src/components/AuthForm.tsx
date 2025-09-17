import React, { useState } from 'react';
import { useSignInWithEmailAndPassword, useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { auth } from '../config/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Icon } from './ui/icon';

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
      <div className="max-w-md mx-auto mt-8">
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="text-center p-8">
            <div className="mx-auto w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-4">
              <Icon size={24} className="text-accent-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </Icon>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Welcome Back!
            </h2>
            <p className="text-muted-foreground mb-4">
              Successfully signed in as <span className="font-medium">{user.user.email}</span>
            </p>
            <div className="inline-flex items-center px-3 py-2 bg-accent/10 rounded-lg text-sm text-accent-foreground">
              <div className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse"></div>
              Connected to Firebase Auth
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-md">
            <Icon size={24} className="text-primary-foreground">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </Icon>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground mb-2">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </CardTitle>
          <p className="text-muted-foreground">
            {isSignUp 
              ? 'Join us to start generating AI-powered quizzes' 
              : 'Sign in to access your quiz dashboard'
            }
          </p>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center">
              <Icon size={18} className="text-destructive mr-3 flex-shrink-0" style={{fill: 'currentColor'}}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
              </Icon>
              <div>
                <p className="font-medium">Authentication Error</p>
                <p className="text-sm text-destructive/80">{error.message}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">
                  Email Address
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="pl-10 bg-input"
                  />
                  <Icon size={18} className="text-muted-foreground absolute left-3 top-3">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                  </Icon>
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="pl-10 bg-input"
                  />
                  <Icon size={18} className="text-muted-foreground absolute left-3 top-3">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </Icon>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-primary hover:bg-primary/90 smooth-transition shadow-md"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Icon size={18} className="animate-spin -ml-1 mr-3">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </Icon>
                  Processing...
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-card text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSignUp(!isSignUp)}
              className="mt-4 text-primary hover:text-primary/80 smooth-transition"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Create one"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};