import React, { useState, useEffect } from 'react';
import { useSignInWithEmailAndPassword, useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Icon } from './ui/Icon';

export const AuthForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Navigate to home page after successful authentication
  useEffect(() => {
    if (user) {
      // Get the intended destination from location state, or default to home
      const locationState = location.state as { from?: { pathname: string } } | null;
      const from = locationState?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

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
              Redirecting...
            </h2>
            <p className="text-muted-foreground mb-4">
              Successfully signed in as <span className="font-medium">{user.user.email}</span>
            </p>
            <div className="inline-flex items-center px-3 py-2 bg-accent/10 rounded-lg text-sm text-accent-foreground">
              <div className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse"></div>
              Taking you to your dashboard...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="linear-glass border border-border/30">
        <CardHeader className="text-center pt-8 pb-6">
          <CardTitle className="text-xl font-semibold text-foreground mb-3">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSignUp 
              ? 'Start generating AI-powered quizzes today' 
              : 'Sign in to access your quiz dashboard'
            }
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {error && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
              <p className="font-medium">Authentication Error</p>
              <p className="text-destructive/80 mt-1">{error.message}</p>
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-destructive/60">Debug Details</summary>
                <pre className="text-xs mt-2 p-2 bg-destructive/5 rounded overflow-auto">
                  {JSON.stringify({
                    code: error.code,
                    message: error.message,
                    name: error.name
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm text-foreground font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="mt-1.5 bg-input border-border/50 focus:border-primary/50 linear-transition"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm text-foreground font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="mt-1.5 bg-input border-border/50 focus:border-primary/50 linear-transition"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-6 linear-button linear-glow-hover"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </div>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground">or</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground linear-transition"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Create one"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};