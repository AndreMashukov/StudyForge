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
import { MascotImage } from '../MascotImage';

const workspaceArtifacts = ['Quizzes', 'Flashcards', 'Slide decks', 'Diagram drills'] as const;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/user-disabled': 'This account has been disabled.',
};

function getAuthErrorMessage(error: { code?: string }): string {
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return 'Could not sign in. Please try again.';
}

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
            <MascotImage
              variant="happy"
              alt="Forge celebrating"
              className="mx-auto mb-4 h-28 w-28"
            />
            <div className={authFormStyles.successIcon}>
              <Icon size={24} className="text-accent-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </Icon>
            </div>
            <h2 className={authFormStyles.successTitle}>
              Welcome back to StudyForge
            </h2>
            <p className={authFormStyles.successSubtitle}>
              Successfully signed in as <span className="font-medium">{user.user.email}</span>
            </p>
            <div className={authFormStyles.successStatus}>
              <div className={authFormStyles.successIndicator}></div>
              Opening your workspace...
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
          <div className={authFormStyles.eyebrow}>
            <span className={authFormStyles.eyebrowDot}></span>
            StudyForge workspace
          </div>
          <CardTitle className={authFormStyles.title}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </CardTitle>
          <p className={authFormStyles.subtitle}>
            {isSignUp 
              ? 'Start building study-ready quizzes, flashcards, and slide decks.' 
              : 'Sign in to continue building study assets from documents, notes, and prompts.'
            }
          </p>
        </CardHeader>

        <CardContent className={authFormStyles.content}>
          {error && (
            <div className={authFormStyles.errorContainer}>
              <p className={authFormStyles.errorTitle}>Sign in failed</p>
              <p className={authFormStyles.errorMessage}>{getAuthErrorMessage(error)}</p>
              {import.meta.env.DEV ? (
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
              ) : null}
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
                  Opening workspace...
                </div>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </Button>
          </form>

          <div className={authFormStyles.divider}>
            <div className={authFormStyles.dividerLine}></div>
          </div>

          <div className={authFormStyles.supportPanel}>
            <p className={authFormStyles.supportLabel}>Inside your workspace</p>
            <div className={authFormStyles.supportChips}>
              {workspaceArtifacts.map((artifact) => (
                <span key={artifact} className={authFormStyles.supportChip}>
                  {artifact}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};