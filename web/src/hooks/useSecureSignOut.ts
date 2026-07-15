import { useCallback, useState } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth, evictFirestoreLocalCache } from '../config/firebase';

interface IUseSecureSignOutResult {
  signOut: () => Promise<boolean>;
  loading: boolean;
  error: Error | undefined;
}

export function useSecureSignOut(): IUseSecureSignOutResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const signOut = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(undefined);

    try {
      await firebaseSignOut(auth);
      await evictFirestoreLocalCache();

      if (typeof window !== 'undefined') {
        window.location.replace('/auth');
      }

      return true;
    } catch (signOutError: unknown) {
      const resolvedError =
        signOutError instanceof Error ? signOutError : new Error(String(signOutError));
      setError(resolvedError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { signOut, loading, error };
}
