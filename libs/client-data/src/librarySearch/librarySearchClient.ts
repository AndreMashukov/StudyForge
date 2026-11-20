import {
  LIBRARY_SEARCH_FULL_RESYNC_AFTER_DAYS,
  LIBRARY_SEARCH_SCHEMA_VERSION,
} from '@shared-types';
import {
  createLibrarySearchEngine,
  type ILibrarySearchOptions,
} from './searchEngine';
import {
  fetchSearchRecordChanges,
  type FetchSearchRecordChanges,
} from './searchSync';
import {
  EMPTY_LIBRARY_SEARCH_RESULTS,
  type ILibrarySearchResults,
  type ILibrarySearchStore,
  type ILibrarySearchSyncMeta,
} from './searchTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ILibrarySearchStatus {
  /** Device records are loaded and indexed; `search` returns real results. */
  ready: boolean;
  syncing: boolean;
  /** This device has completed at least one sync for this learner. */
  hasSynced: boolean;
  /** False when the library is too large to search document text here. */
  bodyTextIndexed: boolean;
  /** Bumps whenever results for the same query could differ. */
  version: number;
}

export interface ILibrarySearchClient {
  /** Loads device records and builds the index. Safe to call repeatedly. */
  start(): Promise<void>;
  /** Pulls changes since the last sync. Concurrent calls share one run. */
  sync(): Promise<void>;
  search(query: string, options?: ILibrarySearchOptions): ILibrarySearchResults;
  getDirectoryTitle(directoryId: string): string | undefined;
  /** Stable between changes, so it works with `useSyncExternalStore`. */
  getStatus(): ILibrarySearchStatus;
  subscribe(listener: () => void): () => void;
  /** Forgets everything on this device, e.g. at sign-out. */
  clear(): Promise<void>;
}

export interface ILibrarySearchClientOptions {
  userId: string;
  store: ILibrarySearchStore;
  /** Injectable for tests; defaults to reading Firestore. */
  fetchChanges?: FetchSearchRecordChanges;
  now?: () => number;
}

/**
 * Library search for one learner on this device: keeps synced search records
 * in the given store, an index of them in memory, and answers queries locally.
 */
export function createLibrarySearchClient(
  options: ILibrarySearchClientOptions,
): ILibrarySearchClient {
  const { userId, store } = options;
  const fetchChanges = options.fetchChanges ?? fetchSearchRecordChanges;
  const now = options.now ?? Date.now;
  const engine = createLibrarySearchEngine();
  const listeners = new Set<() => void>();

  let meta: ILibrarySearchSyncMeta | null = null;
  let startPromise: Promise<void> | null = null;
  let syncPromise: Promise<void> | null = null;
  let status: ILibrarySearchStatus = {
    ready: false,
    syncing: false,
    hasSynced: false,
    bodyTextIndexed: true,
    version: 0,
  };

  const update = (
    patch: Partial<ILibrarySearchStatus>,
    indexChanged = false,
  ): void => {
    status = {
      ...status,
      ...patch,
      bodyTextIndexed: engine.isBodyTextIndexed(),
      version: indexChanged ? status.version + 1 : status.version,
    };
    for (const listener of listeners) listener();
  };

  const needsFullSync = (current: ILibrarySearchSyncMeta | null): boolean =>
    current === null ||
    current.userId !== userId ||
    current.schemaVersion !== LIBRARY_SEARCH_SCHEMA_VERSION ||
    now() - current.lastSyncAtMillis >
      LIBRARY_SEARCH_FULL_RESYNC_AFTER_DAYS * DAY_MS;

  const start = (): Promise<void> => {
    startPromise ??= (async () => {
      const state = await store.load();
      // Records of another learner or an older schema are useless; sync replaces them.
      const usable =
        state.meta !== null &&
        state.meta.userId === userId &&
        state.meta.schemaVersion === LIBRARY_SEARCH_SCHEMA_VERSION;
      meta = usable ? state.meta : null;
      await engine.setRecords(usable ? state.records : []);
      update({ ready: true, hasSynced: usable }, true);
    })();
    return startPromise;
  };

  const runSync = async (): Promise<void> => {
    await start();
    update({ syncing: true });
    try {
      const full = needsFullSync(meta);
      const startedAt = now();
      const changes = await fetchChanges(
        userId,
        full || meta === null ? null : meta.cursorMillis,
      );
      const nextMeta: ILibrarySearchSyncMeta = {
        userId,
        schemaVersion: LIBRARY_SEARCH_SCHEMA_VERSION,
        cursorMillis: Math.max(
          changes.cursorMillis ?? 0,
          full ? 0 : (meta?.cursorMillis ?? 0),
        ),
        lastSyncAtMillis: startedAt,
      };

      if (full) {
        await store.replace(changes.upserts, nextMeta);
        await engine.setRecords(changes.upserts);
      } else {
        await store.apply(changes.upserts, changes.removedIds, nextMeta);
        await engine.applyChanges(changes.upserts, changes.removedIds);
      }
      meta = nextMeta;
      const changed =
        full || changes.upserts.length > 0 || changes.removedIds.length > 0;
      update({ syncing: false, hasSynced: true }, changed);
    } catch (error) {
      update({ syncing: false });
      throw error;
    }
  };

  return {
    start,

    sync() {
      syncPromise ??= runSync().finally(() => {
        syncPromise = null;
      });
      return syncPromise;
    },

    search(query, searchOptions) {
      return status.ready
        ? engine.search(query, searchOptions)
        : EMPTY_LIBRARY_SEARCH_RESULTS;
    },

    getDirectoryTitle: (directoryId) => engine.getDirectoryTitle(directoryId),

    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async clear() {
      await store.clear();
      meta = null;
      await engine.setRecords([]);
      update({ hasSynced: false }, true);
    },
  };
}
