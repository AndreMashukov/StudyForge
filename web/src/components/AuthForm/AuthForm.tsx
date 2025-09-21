import React, { useState, useEffect } from 'react';
import { useSignInWithEmailAndPassword, useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { authFormStyles } from './AuthForm.styles';

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp,] = useState(false);
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
      <div className={authFormStyles.container}>
        <Card className={authFormStyles.successCard}>
          <CardContent className={authFormStyles.successContent}>
            <div className={authFormStyles.successIcon}>
              <Icon size={24} className="text-accent-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </Icon>
            </div>
            <h2 className={authFormStyles.successTitle}>
              Redirecting...
            </h2>
            <p className={authFormStyles.successSubtitle}>
              Successfully signed in as <span className="font-medium">{user.user.email}</span>
            </p>
            <div className={authFormStyles.successStatus}>
              <div className={authFormStyles.successIndicator}></div>
              Taking you to your dashboard...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={authFormStyles.container}>
      <Card className={authFormStyles.card}>
        <CardHeader className={authFormStyles.header}>
          <CardTitle className={authFormStyles.title}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </CardTitle>
          <p className={authFormStyles.subtitle}>
            {isSignUp 
              ? 'Start generating AI-powered quizzes today' 
              : 'Sign in to access your quiz dashboard'
            }
          </p>
        </CardHeader>

        <CardContent className={authFormStyles.content}>
          {error && (
            <div className={authFormStyles.errorContainer}>
              <p className={authFormStyles.errorTitle}>Authentication Error</p>
              <p className={authFormStyles.errorMessage}>{error.message}</p>
              <details className={authFormStyles.errorDetails}>
                <summary className={authFormStyles.errorSummary}>Debug Details</summary>
                <pre className={authFormStyles.errorPre}>
                  {JSON.stringify({
                    code: error.code,
                    message: error.message,
                    name: error.name
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}

          <form onSubmit={handleSubmit} className={authFormStyles.form}>
            <div className={authFormStyles.formFields}>
              <div className={authFormStyles.fieldContainer}>
                <Label htmlFor="email" className={authFormStyles.label}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className={authFormStyles.input}
                />
              </div>

              <div className={authFormStyles.fieldContainer}>
                <Label htmlFor="password" className={authFormStyles.label}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={authFormStyles.input}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className={authFormStyles.submitButton}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className={authFormStyles.loadingSpinner}></div>
                  Processing...
                </div>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </Button>
          </form>

          <div className={authFormStyles.divider}>
            <div className={authFormStyles.dividerLine}>
              <div className={authFormStyles.dividerLineInner}>
                <div className={authFormStyles.dividerBorder}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};