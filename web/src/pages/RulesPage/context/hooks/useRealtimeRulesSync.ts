import { useMemo } from 'react';
import {
  useFirestoreRealtimeSync,
  FirestoreListenerConfig,
} from '../../../../hooks/useFirestoreRealtimeSync';

/**
 * Listens to the user's Firestore `rules` collection for real-time
 * changes and invalidates the RTK Query `Rules` tag when external
 * writes (e.g. via API) are detected.
 */
export const useRealtimeRulesSync = () => {
  const configs: FirestoreListenerConfig[] = useMemo(
    () => [
      {
        collectionName: 'rules',
        tags: ['Rules' as const, 'DirectoryRules' as const],
      },
    ],
    [],
  );

  useFirestoreRealtimeSync(configs);
};
