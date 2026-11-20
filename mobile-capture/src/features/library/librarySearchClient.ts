import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import '../../lib/clientData';
import {
  createLibrarySearchClient,
  type ILibrarySearchClient,
} from '@studyforge/client-data/librarySearch/librarySearchClient';
import { createMobileLibrarySearchStore } from '../../lib/storage/librarySearchStore';

let current: { userId: string; client: ILibrarySearchClient } | null = null;

/** One library search client per signed-in learner, shared by every screen. */
export function getLibrarySearchClient(userId: string): ILibrarySearchClient {
  if (current?.userId !== userId) {
    current = {
      userId,
      client: createLibrarySearchClient({
        userId,
        store: createMobileLibrarySearchStore(),
      }),
    };
  }
  return current.client;
}

/** Removes the learner's search records from this device. Call on sign-out. */
export async function clearLibrarySearch(): Promise<void> {
  const client = current?.client;
  current = null;
  try {
    await (client?.clear() ?? createMobileLibrarySearchStore().clear());
  } catch {
    // Leftover records are replaced on the next learner's first sync.
  }
}

/** Offline or failed: search keeps answering from what is already on the device. */
export function syncLibrarySearch(userId: string): Promise<void> {
  return getLibrarySearchClient(userId)
    .sync()
    .catch(() => undefined);
}

/** The learner's library search client and its live status. */
export function useLibrarySearchClient(userId: string) {
  const client = useMemo(() => getLibrarySearchClient(userId), [userId]);
  const status = useSyncExternalStore(client.subscribe, client.getStatus);
  // Whoever shows results makes sure the device records are loaded; start() is idempotent.
  useEffect(() => {
    client.start().catch(() => undefined);
  }, [client]);
  return { client, status };
}

/**
 * Keeps search records fresh while signed in: at start, when the app returns
 * to the foreground, and when the network comes back.
 */
export function useLibrarySearchSync(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    void syncLibrarySearch(userId);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncLibrarySearch(userId);
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) void syncLibrarySearch(userId);
    });
    return () => {
      appState.remove();
      unsubscribeOnline();
    };
  }, [userId]);
}
