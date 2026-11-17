import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';
import {
  getStorageString,
  hydrateAppStorage,
  removeStorageString,
  setStorageString,
} from '../storage/appStorage';
import { getRecentlyOpenedIds } from '../storage/recentlyOpened';

export const QUERY_CACHE_STORAGE_KEY = 'studyforge.mobile.queryCache.v1';
/** Persisted cache lives a week; gcTime must be at least this long for persistence to keep entries. */
export const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function hydrateQueryCacheStorage(): Promise<void> {
  return hydrateAppStorage([QUERY_CACHE_STORAGE_KEY]);
}

export const queryPersister = createSyncStoragePersister({
  key: QUERY_CACHE_STORAGE_KEY,
  storage: {
    getItem: (key) => getStorageString(key) ?? null,
    setItem: (key, value) => setStorageString(key, value),
    removeItem: (key) => removeStorageString(key),
  },
  throttleTime: 2000,
});

const ALWAYS_PERSISTED = new Set([
  'directoryTree',
  'directoryItems',
  'libraryIndex',
  'agentThreads',
]);
const PERSISTED_WHEN_RECENT = new Set([
  'document',
  'documentContent',
  'artifact',
]);

/**
 * Offline scope (decision 16): the library structure always, plus documents and
 * study sets only when they are among the recently opened items, so the cache stays small.
 */
export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const [kind, , id] = query.queryKey;
  if (typeof kind !== 'string') return false;
  if (ALWAYS_PERSISTED.has(kind)) return true;
  if (!PERSISTED_WHEN_RECENT.has(kind)) return false;
  const itemId = kind === 'artifact' ? query.queryKey[3] : id;
  return typeof itemId === 'string' && getRecentlyOpenedIds().has(itemId);
}
