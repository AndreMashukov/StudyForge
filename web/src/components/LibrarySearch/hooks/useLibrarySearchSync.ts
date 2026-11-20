import { useEffect } from 'react';
import { getLibrarySearchClient } from '../../../services/librarySearch';

const MIN_INTERVAL_MS = 30_000;

/**
 * Keeps the device's search records fresh: on sign-in, whenever search opens,
 * and when the tab regains focus or the network returns.
 */
export function useLibrarySearchSync(
  userId: string | undefined,
  searchOpen: boolean,
): void {
  useEffect(() => {
    if (!userId) return;
    const client = getLibrarySearchClient(userId);
    let lastSyncAt = 0;

    const sync = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastSyncAt < MIN_INTERVAL_MS) return;
      lastSyncAt = now;
      // Offline or failed: search keeps answering from what is already on the device.
      client.sync().catch(() => undefined);
    };

    sync(true);
    const handleFocus = () => sync(false);
    const handleOnline = () => sync(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  useEffect(() => {
    if (userId && searchOpen) {
      getLibrarySearchClient(userId)
        .sync()
        .catch(() => undefined);
    }
  }, [userId, searchOpen]);
}
