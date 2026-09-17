import { useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  defaultFeatureFlags,
  parseFeatureFlags,
  type IFeatureFlags,
} from '@shared-types';
import { db, useEmulator } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFirestoreEffect } from './useFirestoreEffect';

const CLOSED_FLAGS: IFeatureFlags = { supportEnabled: false };

export function useFeatureFlags(): IFeatureFlags {
  const { user } = useAuth();
  const [flags, setFlags] = useState<IFeatureFlags>(() =>
    defaultFeatureFlags(useEmulator),
  );

  useFirestoreEffect(() => {
    if (!user) {
      setFlags(defaultFeatureFlags(useEmulator));
      return;
    }

    const flagsRef = doc(db, 'adminSettings', 'featureFlags');
    return onSnapshot(
      flagsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setFlags(defaultFeatureFlags(useEmulator));
          return;
        }
        setFlags(
          parseFeatureFlags(
            snapshot.data(),
            defaultFeatureFlags(useEmulator),
          ),
        );
      },
      () => {
        setFlags(CLOSED_FLAGS);
      },
    );
  }, [user?.uid]);

  return flags;
}
