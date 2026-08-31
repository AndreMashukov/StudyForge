import React, { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSecureSignOut } from '../../hooks/useSecureSignOut';
import {
  useBootstrapUserProfileMutation,
  useGetCurrentUserProfileQuery,
} from '../../store/api/Auth/authApi';
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
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
};

function isLocationState(value: unknown): value is { from?: { pathname?: string } } {
  return typeof value === 'object' && value !== null && 'from' in value;
}

function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    AUTH_ERROR_MESSAGES[error.code]
  ) {
    return AUTH_ERROR_MESSAGES[error.code];
  }
  return 'Authentication failed. Please try again.';
}

function getRedirectPath(locationState: unknown, forceUsage: boolean): string {
  if (forceUsage) {
    return '/usage';
  }
  if (
    isLocationState(locationState) &&
    typeof locationState.from?.pathname === 'string' &&
    locationState.from.pathname !== '/auth'
  ) {
    return locationState.from.pathname;
  }
  return '/';
}

async function sendVerificationEmail() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Create or sign in to your account first.');
  }
  await sendEmailVerification(currentUser, {
    url: `${window.location.origin}/auth?mode=verify`,
  });
}

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingVerification, setIsRefreshingVerification] = useState(false);
  const [verificationRefreshCount, setVerificationRefreshCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { signOut, loading: signOutLoading } = useSecureSignOut();
  const [bootstrapUserProfile, bootstrapState] = useBootstrapUserProfileMutation();
  const { data: profile, refetch: refetchProfile } = useGetCurrentUserProfileQuery(undefined, {
    skip: !user,
  });
  const bootstrappedUserIdRef = useRef<string | null>(null);

  const isVerified = user?.emailVerified === true;
  const isExempt = profile?.emailVerificationExempt === true;
  const canEnterWorkspace = Boolean(user && (isVerified || isExempt));
  const forceUsageRedirect = isSignUp || searchParams.get('mode') === 'verify';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNotice(null);

    if (isSignUp && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user, {
          url: `${window.location.origin}/auth?mode=verify`,
        });
        setNotice('Verification email sent. Check your inbox before opening your workspace.');
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        setNotice('Verify your email before opening your workspace.');
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMessage(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await sendVerificationEmail();
      setNotice('Verification email sent. Check your inbox and return here after verifying.');
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) {
      return;
    }
    setErrorMessage(null);
    setIsRefreshingVerification(true);
    try {
      await reload(auth.currentUser);
      setVerificationRefreshCount((count) => count + 1);
      await refetchProfile();
      if (!auth.currentUser.emailVerified && !isExempt) {
        setNotice('Email is not verified yet. Check the link in your inbox.');
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsRefreshingVerification(false);
    }
  };

  const handleSignOut = async () => {
    bootstrappedUserIdRef.current = null;
    await signOut();
  };

  const loading =
    isSubmitting ||
    isRefreshingVerification ||
    bootstrapState.isLoading ||
    signOutLoading;

  useEffect(() => {
    if (!user || !canEnterWorkspace || bootstrappedUserIdRef.current === user.uid) {
      return;
    }

    bootstrappedUserIdRef.current = user.uid;
    const redirectPath = getRedirectPath(location.state, forceUsageRedirect);
    bootstrapUserProfile()
      .unwrap()
      .then(() => {
        navigate(redirectPath, { replace: true });
      })
      .catch((error) => {
        bootstrappedUserIdRef.current = null;
        setErrorMessage(getAuthErrorMessage(error));
      });
  }, [
    bootstrapUserProfile,
    canEnterWorkspace,
    forceUsageRedirect,
    location.state,
    navigate,
    user,
    verificationRefreshCount,
  ]);

  if (user && !canEnterWorkspace) {
    return (
      <div className={authFormStyles.container}>
        <Card className={authFormStyles.successCard}>
          <CardContent className={authFormStyles.successContent}>
            <MascotImage
              variant="curious"
              alt="Forge waiting for verification"
              className="mx-auto mb-4 h-28 w-28"
            />
            <h2 className={authFormStyles.successTitle}>Verify your email</h2>
            <p className={authFormStyles.successSubtitle}>
              We sent a verification link to{' '}
              <span className="font-medium">{user.email}</span>. Verify the email, then refresh
              your status here.
            </p>
            {notice ? (
              <p className="mb-4 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {notice}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button type="button" onClick={handleRefreshVerification} disabled={loading}>
                {isRefreshingVerification ? 'Checking...' : 'Refresh status'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVerification}
                disabled={loading}
              >
                Resend email
              </Button>
              <Button type="button" variant="ghost" onClick={handleSignOut} disabled={loading}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && canEnterWorkspace) {
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
              Opening StudyForge
            </h2>
            <p className={authFormStyles.successSubtitle}>
              Signed in as <span className="font-medium">{user.email}</span>
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
          {errorMessage && (
            <div className={authFormStyles.errorContainer}>
              <p className={authFormStyles.errorTitle}>Authentication failed</p>
              <p className={authFormStyles.errorMessage}>{errorMessage}</p>
            </div>
          )}
          {notice ? (
            <div className="mb-6 rounded-2xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
              {notice}
            </div>
          ) : null}

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

              {isSignUp ? (
                <div className={authFormStyles.fieldContainer}>
                  <Label htmlFor="confirmPassword" className={authFormStyles.label}>
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm your password"
                    required
                    className={authFormStyles.input}
                  />
                </div>
              ) : null}
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password || (isSignUp && !confirmPassword)}
              className={authFormStyles.submitButton}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className={authFormStyles.loadingSpinner}></div>
                  Working...
                </div>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : 'New to StudyForge?'}{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setIsSignUp((value) => !value);
                setErrorMessage(null);
                setNotice(null);
              }}
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </div>

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