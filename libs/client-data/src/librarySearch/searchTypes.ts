import type { LibrarySearchItemType, LibrarySearchRecord } from '@shared-types';

/** A search record as kept on the device. */
export interface ILocalSearchRecord {
  /** `${itemType}_${sourceId}`, the search record's document id. */
  id: string;
  itemType: LibrarySearchItemType;
  sourceId: string;
  /** Containing directory; for a directory, its parent. */
  directoryId: string | null;
  title: string;
  description?: string;
  tags?: string[];
  text?: string;
  generationStatus?: LibrarySearchRecord['generationStatus'];
}

export interface ILibrarySearchSyncMeta {
  userId: string;
  schemaVersion: number;
  /** `updatedAt` of the newest record seen, in milliseconds. */
  cursorMillis: number;
  lastSyncAtMillis: number;
}

export interface ILibrarySearchStoreState {
  meta: ILibrarySearchSyncMeta | null;
  records: ILocalSearchRecord[];
}

/**
 * Device persistence for synced search records. Each app supplies its own
 * (IndexedDB on web, MMKV on mobile); this library stays platform neutral.
 */
export interface ILibrarySearchStore {
  load(): Promise<ILibrarySearchStoreState>;
  /** Incremental sync result: upsert some records, drop others. */
  apply(
    upserts: ILocalSearchRecord[],
    removedIds: string[],
    meta: ILibrarySearchSyncMeta,
  ): Promise<void>;
  /** Full sync result: this is now the whole set. */
  replace(
    records: ILocalSearchRecord[],
    meta: ILibrarySearchSyncMeta,
  ): Promise<void>;
  clear(): Promise<void>;
}

/** Keeps records for the session only. Used when no durable storage is available. */
export function createMemoryLibrarySearchStore(): ILibrarySearchStore {
  let meta: ILibrarySearchSyncMeta | null = null;
  const records = new Map<string, ILocalSearchRecord>();
  return {
    async load() {
      return { meta, records: [...records.values()] };
    },
    async apply(upserts, removedIds, nextMeta) {
      for (const id of removedIds) records.delete(id);
      for (const record of upserts) records.set(record.id, record);
      meta = nextMeta;
    },
    async replace(nextRecords, nextMeta) {
      records.clear();
      for (const record of nextRecords) records.set(record.id, record);
      meta = nextMeta;
    },
    async clear() {
      records.clear();
      meta = null;
    },
  };
}

export interface ISearchSnippetSegment {
  text: string;
  highlighted: boolean;
}

export interface ILibrarySearchHit {
  itemType: LibrarySearchItemType;
  /** Source record id of the item. */
  id: string;
  title: string;
  directoryId?: string;
  /** Breadcrumb of the containing directory, e.g. "Biology › Cells". */
  path: string;
  generationStatus?: LibrarySearchRecord['generationStatus'];
  /** Passage from the document body, when the body is what matched. */
  snippet?: ISearchSnippetSegment[];
}

export interface ILibrarySearchResults {
  directories: ILibrarySearchHit[];
  documents: ILibrarySearchHit[];
  artifacts: ILibrarySearchHit[];
}

export const EMPTY_LIBRARY_SEARCH_RESULTS: ILibrarySearchResults = {
  directories: [],
  documents: [],
  artifacts: [],
};
