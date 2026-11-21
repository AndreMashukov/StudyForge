import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  narrationPartSchema,
  narrationRecordSchema,
  type NarrationPart,
  type NarrationRecord,
} from '@shared-types';
import {
  processNarrationAudioDeletionSoon,
  queueNarrationAudioDeletion,
} from './narration-audio-deletions';

/**
 * Server-only field stored next to the client-visible narration record. What a
 * run reserved and stored lives on `narrationRuns/{runId}`.
 */
export interface INarrationRunFields {
  runId?: string;
  runStartedAt?: string;
}

export type StoredNarrationRecord = NarrationRecord & INarrationRunFields;

export function narrationRecordRef(userId: string, documentId: string) {
  return getFirestore()
    .collection('users')
    .doc(userId)
    .collection('narrations')
    .doc(documentId);
}

export function narrationStoragePrefix(
  userId: string,
  documentId: string,
): string {
  return `users/${userId}/narrations/${documentId}/`;
}

export function narrationPartStoragePath(
  userId: string,
  documentId: string,
  key: string,
): string {
  return `${narrationStoragePrefix(userId, documentId)}${key}.mp3`;
}

export function parseStoredNarrationRecord(
  data: unknown,
): StoredNarrationRecord | null {
  const parsed = narrationRecordSchema.safeParse(data);
  if (!parsed.success) return null;
  const raw = typeof data === 'object' && data !== null ? data : {};
  const runStartedAt =
    'runStartedAt' in raw ? Reflect.get(raw, 'runStartedAt') : undefined;
  return {
    ...parsed.data,
    ...(typeof runStartedAt === 'string' ? { runStartedAt } : {}),
  };
}

export async function readNarrationRecord(
  userId: string,
  documentId: string,
): Promise<StoredNarrationRecord | null> {
  const snapshot = await narrationRecordRef(userId, documentId).get();
  return snapshot.exists ? parseStoredNarrationRecord(snapshot.data()) : null;
}

/** Removes Firestore-unfriendly `undefined` values from a part. */
export function cleanNarrationPart(part: NarrationPart): NarrationPart {
  const parsed = narrationPartSchema.parse(part);
  const clean: NarrationPart = {
    index: parsed.index,
    key: parsed.key,
    blockStart: parsed.blockStart,
    blockEnd: parsed.blockEnd,
    charCount: parsed.charCount,
    status: parsed.status,
  };
  if (parsed.storagePath !== undefined) clean.storagePath = parsed.storagePath;
  if (parsed.durationMs !== undefined) clean.durationMs = parsed.durationMs;
  if (parsed.sizeBytes !== undefined) clean.sizeBytes = parsed.sizeBytes;
  if (parsed.errorMessage !== undefined)
    clean.errorMessage = parsed.errorMessage;
  return clean;
}

/** Bytes of stored audio for these parts; parts sharing one file count it once. */
export function storedPartBytes(parts: NarrationPart[]): number {
  const files = new Map<string, number>();
  for (const part of parts) {
    if (part.status === 'ready' && part.storagePath) {
      files.set(part.storagePath, part.sizeBytes ?? 0);
    }
  }
  return [...files.values()].reduce((sum, bytes) => sum + bytes, 0);
}

/**
 * Removes a document's narration: the record, and in the same transaction a
 * deletion entry for its audio files and the storage they use (see
 * `narration-audio-deletions`), which is then processed. Only the record's own
 * files are deleted, never the whole prefix, so a narration started right
 * after this cannot lose its new files. A run still in progress notices the
 * record is gone and its settlement deletes the files it uploaded; a run whose
 * worker died is settled by the stale-run sweep.
 */
export async function removeNarration(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const ref = narrationRecordRef(userId, documentId);
  const removed = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const record = parseStoredNarrationRecord(snapshot.data());
    transaction.delete(ref);
    const deletionId = record
      ? queueNarrationAudioDeletion(
          transaction,
          userId,
          documentId,
          record.parts,
        )
      : null;
    return { record, deletionId };
  });
  if (!removed) return false;
  if (!removed.record) {
    logger.warn('Removed a narration record that could not be read', {
      userId,
      documentId,
    });
  }
  await processNarrationAudioDeletionSoon(removed.deletionId);
  logger.info('Narration removed', {
    userId,
    documentId,
    freedBytes: storedPartBytes(removed.record?.parts ?? []),
  });
  return true;
}
