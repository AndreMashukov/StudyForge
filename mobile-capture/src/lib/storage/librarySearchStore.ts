import { z } from 'zod';
import {
  librarySearchItemTypeSchema,
  type LibrarySearchItemType,
} from '@shared-types';
import {
  createMemoryLibrarySearchStore,
  type ILibrarySearchStore,
  type ILibrarySearchSyncMeta,
  type ILocalSearchRecord,
} from '@studyforge/client-data/librarySearch/searchTypes';
import { loadCreateMmkv, type IMmkvInstance } from './appStorage';

const META_KEY = 'meta';
const RECORD_PREFIX = 'r:';

// The shared schema is from a different Zod major version, so it is checked
// through its own `safeParse` rather than nested in this app's schema.
const itemTypeSchema = z.custom<LibrarySearchItemType>(
  (value) => librarySearchItemTypeSchema.safeParse(value).success,
);

const recordSchema = z.object({
  id: z.string(),
  itemType: itemTypeSchema,
  sourceId: z.string(),
  directoryId: z.string().nullable(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  text: z.string().optional(),
  generationStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  lastActivityAt: z.number().optional(),
});

const metaSchema = z.object({
  userId: z.string(),
  schemaVersion: z.number(),
  cursorMillis: z.number(),
  lastSyncAtMillis: z.number(),
});

interface IListableMmkv extends IMmkvInstance {
  getAllKeys(): string[];
  clearAll(): void;
}

function isListable(instance: IMmkvInstance): instance is IListableMmkv {
  return (
    'getAllKeys' in instance &&
    typeof instance.getAllKeys === 'function' &&
    'clearAll' in instance &&
    typeof instance.clearAll === 'function'
  );
}

function parseJson<T>(schema: z.ZodType<T>, raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function createMmkvLibrarySearchStore(
  mmkv: IListableMmkv,
): ILibrarySearchStore {
  const writeMeta = (meta: ILibrarySearchSyncMeta) =>
    mmkv.set(META_KEY, JSON.stringify(meta));
  const writeRecord = (record: ILocalSearchRecord) =>
    mmkv.set(`${RECORD_PREFIX}${record.id}`, JSON.stringify(record));

  return {
    async load() {
      const records: ILocalSearchRecord[] = [];
      for (const key of mmkv.getAllKeys()) {
        if (!key.startsWith(RECORD_PREFIX)) continue;
        const record = parseJson(recordSchema, mmkv.getString(key));
        if (record) records.push(record);
      }
      return { meta: parseJson(metaSchema, mmkv.getString(META_KEY)), records };
    },
    async apply(upserts, removedIds, meta) {
      for (const id of removedIds) mmkv.remove(`${RECORD_PREFIX}${id}`);
      for (const record of upserts) writeRecord(record);
      writeMeta(meta);
    },
    async replace(records, meta) {
      mmkv.clearAll();
      for (const record of records) writeRecord(record);
      writeMeta(meta);
    },
    async clear() {
      mmkv.clearAll();
    },
  };
}

/**
 * Search records for library search, in their own MMKV file so they survive
 * restarts and work offline. Without MMKV (Expo Go) they last for the session:
 * AsyncStorage is too small for document text.
 */
export function createMobileLibrarySearchStore(): ILibrarySearchStore {
  try {
    const mmkv = loadCreateMmkv()?.({ id: 'studyforge-library-search' });
    if (mmkv && isListable(mmkv)) {
      return createMmkvLibrarySearchStore(mmkv);
    }
  } catch {
    // Fall through to memory.
  }
  return createMemoryLibrarySearchStore();
}
