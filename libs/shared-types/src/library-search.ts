import { z } from 'zod';
import { agentReferencedItemTypeSchema } from './agent';

/**
 * Library search: finds directories, documents and artifacts by name,
 * documents by their text, and agent chats by title and message text.
 * Functions maintain one search record per item under
 * `users/{uid}/searchRecords/{recordId}`; clients sync the records and match on
 * the device.
 */

/**
 * Bump to make every device drop its local index and sync from scratch.
 * v2: chat records. Older clients skip them but still advance their sync
 * cursor past them, so they must resync after upgrading.
 */
export const LIBRARY_SEARCH_SCHEMA_VERSION = 2;

/** How long a deleted item's search record stays before Firestore TTL removes it. */
export const LIBRARY_SEARCH_TOMBSTONE_TTL_DAYS = 30;

/**
 * A device that last synced longer ago than this may have missed expired
 * tombstones, so it syncs from scratch. Must stay below the tombstone TTL.
 */
export const LIBRARY_SEARCH_FULL_RESYNC_AFTER_DAYS = 25;

/**
 * Library items plus `chat` (an agent thread). Kept apart from
 * `agentReferencedItemTypeSchema`: a chat is searchable but never an agent card.
 */
export const librarySearchItemTypeSchema = z.enum([
  ...agentReferencedItemTypeSchema.options,
  'chat',
]);
export type LibrarySearchItemType = z.output<
  typeof librarySearchItemTypeSchema
>;

export const librarySearchGenerationStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
]);

/**
 * Fields of a search record. The stored record also carries `updatedAt` (the
 * sync cursor) and, on tombstones, `expiresAt`; both are Firestore timestamps
 * and are read with the SDK in use, not through this schema.
 */
export const librarySearchRecordSchema = z.object({
  itemType: librarySearchItemTypeSchema,
  sourceId: z.string().min(1),
  /**
   * Containing directory; for a directory, its parent; for a chat, its home
   * folder. Null at the library root and for chats without a home folder.
   */
  directoryId: z.string().min(1).nullable(),
  title: z.string(),
  /** Document description; for a chat, the preview of its latest reply. */
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  /**
   * Plain text of a completed document's body, or of a chat's messages
   * (newest kept), capped.
   */
  text: z.string().optional(),
  textTruncated: z.boolean().optional(),
  generationStatus: librarySearchGenerationStatusSchema.optional(),
  /** Chats only: epoch millis of the latest message, for ranking and display. */
  lastActivityAt: z.number().int().nonnegative().optional(),
  /** Hash of every searchable field; an unchanged hash means no rewrite. */
  contentHash: z.string().min(1),
  /** Cloud Storage md5 of the document body the text was extracted from. */
  sourceMd5: z.string().optional(),
  deleted: z.boolean(),
  schemaVersion: z.number().int(),
});

export type LibrarySearchRecord = z.output<typeof librarySearchRecordSchema>;

export function buildLibrarySearchRecordId(
  itemType: LibrarySearchItemType,
  sourceId: string,
): string {
  return `${itemType}_${sourceId}`;
}
