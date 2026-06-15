import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  return useMemo(
    () => ({
      user,
      initializing,
      signIn,
      signOut: signOutUser,
    }),
    [user, initializing, signIn, signOutUser]
  );
}
