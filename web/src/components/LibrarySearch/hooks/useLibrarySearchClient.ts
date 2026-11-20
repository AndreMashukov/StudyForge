import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getLibrarySearchClient } from '../../../services/librarySearch';

/** The signed-in learner's library search client and its live status. */
export function useLibrarySearchClient(userId: string) {
  const client = useMemo(() => getLibrarySearchClient(userId), [userId]);
  const status = useSyncExternalStore(client.subscribe, client.getStatus);
  // Whoever shows results makes sure the device records are loaded; start() is idempotent.
  useEffect(() => {
    client.start().catch(() => undefined);
  }, [client]);
  return { client, status };
}
