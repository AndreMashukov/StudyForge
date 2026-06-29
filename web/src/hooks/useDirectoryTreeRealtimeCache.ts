import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from './redux';
import { useFirestoreEffect } from './useFirestoreEffect';
import { patchDirectoryTreeCache } from './directoryRealtimeCacheUtils';

/**
 * Patches the RTK `getDirectoryTree` cache when any directory record changes so
 * the sidebar tree and Phase 4 folder cards update without a callable refetch.
 * Mutations still invalidate TREE explicitly; this hook is the realtime path.
 */
export const useDirectoryTreeRealtimeCache = () => {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const uid = user?.uid;

  useFirestoreEffect(() => {
    if (!uid) {
      return;
    }

    let active = true;
    const directoriesQuery = query(collection(db, 'users', uid, 'directories'));
    let isInitial = true;

    const unsubscribe = onSnapshot(
      directoriesQuery,
      (snapshot) => {
        if (!active) {
          return;
        }
        if (isInitial) {
          isInitial = false;
          return;
        }

        for (const change of snapshot.docChanges()) {
          patchDirectoryTreeCache(dispatch, change);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, dispatch]);
};
