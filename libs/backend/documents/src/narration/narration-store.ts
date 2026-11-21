import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  narrationPartSchema,
  narrationRecordSchema,
  type NarrationPart,
  type NarrationRecord,
} from '@shared-types';
import { adjustUserStorageUsage } from '@study-forge/backend-core/services/usage-limits-service';
import { DocumentService } from '../document-storage';

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

/** Deletes the audio of these parts and gives their storage back. */
export async function deleteNarrationPartAudio(
  userId: string,
  parts: NarrationPart[],
): Promise<void> {
  const bucket = DocumentService.getBucket();
  const withAudio = parts.filter((part) => part.storagePath);
  const paths = [...new Set(withAudio.map((part) => part.storagePath ?? ''))];
  await Promise.all(
    paths.map((storagePath) =>
      bucket
        .file(storagePath)
        .delete({ ignoreNotFound: true })
        .catch((error: unknown) => {
          logger.warn('Narration part audio delete failed', {
            userId,
            storagePath,
            message: error instanceof Error ? error.message : String(error),
          });
        }),
    ),
  );
  const bytes = storedPartBytes(withAudio);
  if (bytes > 0) {
    await adjustUserStorageUsage({ userId, deltaBytes: -bytes });
  }
}

/**
 * Removes a document's narration: the record, every audio file under its
 * prefix, and the storage it used. A run still in progress notices the record
 * is gone, discards what it produces and settles its run; a run whose worker
 * died is settled by the stale-run sweep.
 */
export async function removeNarration(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const ref = narrationRecordRef(userId, documentId);
  const removed = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    transaction.delete(ref);
    return parseStoredNarrationRecord(snapshot.data());
  });

  const bucket = DocumentService.getBucket();
  await bucket
    .deleteFiles({ prefix: narrationStoragePrefix(userId, documentId) })
    .catch((error: unknown) => {
      logger.warn('Narration audio prefix delete failed', {
        userId,
        documentId,
        message: error instanceof Error ? error.message : String(error),
      });
    });

  if (!removed) return false;
  const bytes = storedPartBytes(removed.parts);
  if (bytes > 0) {
    await adjustUserStorageUsage({ userId, deltaBytes: -bytes });
  }
  logger.info('Narration removed', { userId, documentId, freedBytes: bytes });
  return true;
}
