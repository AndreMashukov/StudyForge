import { useMemo } from 'react';
import {
  useFirestoreRealtimeSync,
  type FirestoreListenerConfig,
} from '../../hooks/useFirestoreRealtimeSync';

/**
 * Invalidates RTK rule caches when Cloud Functions (including the workspace
 * agent) write to the user's rules collection. Directory detail and artifact
 * modals do not have their own rules listener.
 */
export function RulesRealtimeBridge() {
  const configs: FirestoreListenerConfig[] = useMemo(
    () => [
      {
        collectionName: 'rules',
        listLimit: 100,
        tags: ['Rules' as const, 'DirectoryRules' as const],
      },
    ],
    [],
  );

  useFirestoreRealtimeSync(configs);

  return null;
}
