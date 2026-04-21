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
      console.log('[RealtimeSync] Skipped — enabled:', enabled, 'uid:', uid ?? 'none');
      return;
    }

    console.log('[RealtimeSync] Registering listeners', JSON.stringify({
      uid,
      collections: configs.map((c) => ({
        name: c.collectionName,
        filters: c.filters,
      })),
    }));

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
        (snapshot) => {
          if (isInitial) {
            isInitial = false;
            console.log('[RealtimeSync] Initial snapshot received', JSON.stringify({
              collection: cfg.collectionName,
              filters: cfg.filters,
              docCount: snapshot.size,
            }));
            return;
          }
          const changes = snapshot.docChanges().map((c) => ({
            type: c.type,
            id: c.doc.id,
          }));
          const tags = configsRef.current[idx].tags;
          console.log('[RealtimeSync] Change detected — invalidating tags', JSON.stringify({
            collection: cfg.collectionName,
            changes,
            tags,
          }));
          dispatch(baseApi.util.invalidateTags(tags));
        },
        (error) => {
          console.warn(
            '[RealtimeSync] Listener error', JSON.stringify({
              collection: cfg.collectionName,
              filters: cfg.filters,
              code: (error as { code?: string }).code,
              message: error.message,
            }),
          );
        },
      );

      unsubscribes.push(unsub);
    });

    return () => {
      console.log('[RealtimeSync] Cleaning up listeners', JSON.stringify({
        uid,
        collections: configs.map((c) => c.collectionName),
      }));
      unsubscribes.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled, configKey, dispatch]);
};
