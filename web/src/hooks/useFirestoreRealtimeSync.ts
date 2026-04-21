import { useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from './redux';
import { baseApi } from '../store/api/baseApi';

/**
 * A single Firestore collection listener configuration.
 * - `collectionName`: sub-collection under `users/{uid}/`
 * - `filters`: optional Firestore where-clause pairs
 * - `tags`: RTK Query tags to invalidate when the collection changes
 */
export interface FirestoreListenerConfig {
  collectionName: string;
  filters?: { field: string; value: unknown }[];
  tags: Parameters<typeof baseApi.util.invalidateTags>[0];
}

/**
 * Sets up Firestore `onSnapshot` listeners that invalidate RTK Query
 * cache tags when external writes are detected.
 *
 * Skips the first snapshot per listener (initial load) so that RTK
 * Query's own fetch is not redundantly duplicated.
 */
export const useFirestoreRealtimeSync = (
  configs: FirestoreListenerConfig[],
  enabled = true,
) => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  // Serialize configs so the effect re-runs only when the logical
  // shape changes (directoryId etc.), not on every render.
  const configKey = JSON.stringify(
    configs.map((c) => ({
      c: c.collectionName,
      f: c.filters,
    })),
  );

  // Track the latest tags by ref so the snapshot callback always
  // sees the current value without triggering effect re-runs.
  const configsRef = useRef(configs);
  configsRef.current = configs;

  useEffect(() => {
    if (!enabled || !uid) {
      return;
    }

    const unsubscribes: Unsubscribe[] = [];

    configs.forEach((cfg, idx) => {
      const colRef = collection(db, 'users', uid, cfg.collectionName);

      let q;
      if (cfg.filters && cfg.filters.length > 0) {
        const constraints = cfg.filters.map((f) =>
          where(f.field, '==', f.value),
        );
        q = query(colRef, ...constraints);
      } else {
        q = query(colRef);
      }

      let isInitial = true;

      const unsub = onSnapshot(
        q,
        () => {
          if (isInitial) {
            isInitial = false;
            return;
          }
          const tags = configsRef.current[idx].tags;
          dispatch(baseApi.util.invalidateTags(tags));
        },
        () => {},
      );

      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled, configKey, dispatch]);
};
