import { useRef } from 'react';
import {
  collection,
  limit,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from './redux';
import { baseApi } from '../store/api/baseApi';
import { useFirestoreEffect } from './useFirestoreEffect';

/**
 * A single Firestore collection listener configuration.
 * - `collectionName`: sub-collection under `users/{uid}/`
 * - `filters`: optional Firestore where-clause pairs
 * - `tags`: RTK Query tags to invalidate when the collection changes
 * - `invalidateOnInitial`: invalidate on the first snapshot too, useful when
 *   cached RTK data may show a pending record that completed before the
 *   listener's initial snapshot was delivered
 */
export interface FirestoreListenerConfig {
  collectionName: string;
  filters?: { field: string; value: unknown }[];
  /** Required for collections with bounded list rules in firestore.rules. */
  listLimit?: number;
  invalidateOnInitial?: boolean;
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
      l: c.listLimit,
      i: c.invalidateOnInitial,
    })),
  );

  // Track the latest tags by ref so the snapshot callback always
  // sees the current value without triggering effect re-runs.
  const configsRef = useRef(configs);
  configsRef.current = configs;

  useFirestoreEffect(() => {
    if (!enabled || !uid) {
      return;
    }

    let active = true;
    const unsubscribes: Unsubscribe[] = [];

    configs.forEach((cfg, idx) => {
      const colRef = collection(db, 'users', uid, cfg.collectionName);

      let q;
      if (cfg.filters && cfg.filters.length > 0) {
        const constraints: QueryConstraint[] = cfg.filters.map((f) =>
          where(f.field, '==', f.value),
        );
        if (cfg.listLimit !== undefined) {
          constraints.push(limit(cfg.listLimit));
        }
        q = query(colRef, ...constraints);
      } else if (cfg.listLimit !== undefined) {
        q = query(colRef, limit(cfg.listLimit));
      } else {
        q = query(colRef);
      }

      let isInitial = true;

      const unsub = onSnapshot(
        q,
        () => {
          if (!active) return;
          if (isInitial) {
            isInitial = false;
            if (!configsRef.current[idx].invalidateOnInitial) {
              return;
            }
          }
          const tags = configsRef.current[idx].tags;
          dispatch(baseApi.util.invalidateTags(tags));
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
      );

      unsubscribes.push(unsub);
    });

    return () => {
      active = false;
      unsubscribes.forEach((u) => u());
    };
  }, [uid, enabled, configKey, dispatch]);
};
