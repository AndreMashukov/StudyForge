import {
  createMemoryLibrarySearchStore,
  type ILibrarySearchStore,
  type ILibrarySearchSyncMeta,
  type ILocalSearchRecord,
} from '@studyforge/client-data/librarySearch/searchTypes';

const DB_NAME = 'studyforge-library-search';
const DB_VERSION = 1;
const RECORDS = 'records';
const META = 'meta';
const META_KEY = 'sync';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS)) {
        db.createObjectStore(RECORDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Library search storage is blocked'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Search records for library search, kept in IndexedDB so they survive reloads and work offline. */
function createIndexedDbLibrarySearchStore(): ILibrarySearchStore {
  let database: Promise<IDBDatabase> | null = null;
  const db = () => {
    database ??= openDatabase();
    return database;
  };

  const write = async (
    work: (records: IDBObjectStore, meta: IDBObjectStore) => void,
  ): Promise<void> => {
    const transaction = (await db()).transaction([RECORDS, META], 'readwrite');
    work(transaction.objectStore(RECORDS), transaction.objectStore(META));
    await transactionDone(transaction);
  };

  return {
    async load() {
      const transaction = (await db()).transaction([RECORDS, META], 'readonly');
      // Values were written by this module with these shapes.
      const records: Promise<ILocalSearchRecord[]> = requestResult(
        transaction.objectStore(RECORDS).getAll(),
      );
      const meta: Promise<ILibrarySearchSyncMeta | undefined> = requestResult(
        transaction.objectStore(META).get(META_KEY),
      );
      return { records: await records, meta: (await meta) ?? null };
    },

    apply(upserts, removedIds, meta) {
      return write((records, metaStore) => {
        for (const id of removedIds) records.delete(id);
        for (const record of upserts) records.put(record);
        metaStore.put(meta, META_KEY);
      });
    },

    replace(nextRecords, meta) {
      return write((records, metaStore) => {
        records.clear();
        for (const record of nextRecords) records.put(record);
        metaStore.put(meta, META_KEY);
      });
    },

    clear() {
      return write((records, metaStore) => {
        records.clear();
        metaStore.clear();
      });
    },
  };
}

/** Falls back to session-only memory where IndexedDB is unavailable (e.g. some private modes). */
export function createWebLibrarySearchStore(): ILibrarySearchStore {
  if (typeof indexedDB === 'undefined') {
    return createMemoryLibrarySearchStore();
  }
  const durable = createIndexedDbLibrarySearchStore();
  const memory = createMemoryLibrarySearchStore();
  let useMemory = false;

  const run = async <T>(
    action: (store: ILibrarySearchStore) => Promise<T>,
  ): Promise<T> => {
    if (useMemory) {
      return action(memory);
    }
    try {
      return await action(durable);
    } catch {
      useMemory = true;
      return action(memory);
    }
  };

  return {
    load: () => run((store) => store.load()),
    apply: (upserts, removedIds, meta) =>
      run((store) => store.apply(upserts, removedIds, meta)),
    replace: (records, meta) => run((store) => store.replace(records, meta)),
    clear: () => run((store) => store.clear()),
  };
}
