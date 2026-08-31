import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from '../components/ui/Spinner';
import { useGetCurrentUserProfileQuery } from '../store/api/Auth/authApi';

interface IProtectedRoute {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: IProtectedRoute) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useGetCurrentUserProfileQuery(undefined, {
    skip: !user,
  });

  if (loading || (user && !user.emailVerified && isProfileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" variant="muted" className="mx-auto" />
          <p className="mt-4 text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!user.emailVerified && profile?.emailVerificationExempt !== true) {
    return <Navigate to="/auth?mode=verify" state={{ from: location }} replace />;
  }

  return children as React.ReactElement;
};