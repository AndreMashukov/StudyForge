import {
  FieldValue,
  getFirestore,
  type Transaction,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import type { NarrationPart } from '@shared-types';
import { storageUsageDocRef } from '@study-forge/backend-core/services/usage-quota-service';
import { DocumentService } from '../document-storage';

/**
 * Narration audio files no narration refers to any more, waiting to be
 * deleted, with the storage each one still counts against.
 *
 * `narrationAudioDeletions/{id}` — server only. An entry is written in the
 * same transaction that takes its files out of the narration record, so a
 * crash or a failed delete cannot lose a file or the storage it holds.
 * Processing deletes the files, then gives their storage back and removes the
 * entry in one transaction: storage is given back once, and only for files
 * that are gone. An entry that fails stays for the stale-run sweep.
 */

const COLLECTION = 'narrationAudioDeletions';
/** Entries older than this are left to the sweep; newer ones are being processed inline. */
export const NARRATION_AUDIO_DELETION_RETRY_MS = 10 * 60_000;

export interface INarrationAudioFile {
  path: string;
  /** Storage the file counts against; zero for a file that was never ready. */
  bytes: number;
}

export interface INarrationAudioDeletion {
  userId: string;
  documentId: string;
  files: INarrationAudioFile[];
  createdAt: string;
}

function deletionRef(id: string) {
  return getFirestore().collection(COLLECTION).doc(id);
}

/**
 * The files of these parts, each once. A file counts the bytes of a ready part
 * that uses it, as the storage tally did when that part became ready.
 */
export function narrationAudioFiles(
  parts: NarrationPart[],
): INarrationAudioFile[] {
  const files = new Map<string, number>();
  for (const part of parts) {
    if (!part.storagePath) continue;
    const bytes = part.status === 'ready' ? (part.sizeBytes ?? 0) : 0;
    files.set(
      part.storagePath,
      Math.max(files.get(part.storagePath) ?? 0, bytes),
    );
  }
  return [...files].map(([path, bytes]) => ({ path, bytes }));
}

function parseDeletion(data: unknown): INarrationAudioDeletion | null {
  if (typeof data !== 'object' || data === null) return null;
  const read = (key: string) =>
    key in data ? Reflect.get(data, key) : undefined;
  const userId = read('userId');
  const documentId = read('documentId');
  const createdAt = read('createdAt');
  const files = read('files');
  if (
    typeof userId !== 'string' ||
    typeof documentId !== 'string' ||
    typeof createdAt !== 'string' ||
    !Array.isArray(files)
  ) {
    return null;
  }
  const parsedFiles: INarrationAudioFile[] = [];
  for (const file of files) {
    if (typeof file !== 'object' || file === null) continue;
    const path = 'path' in file ? Reflect.get(file, 'path') : undefined;
    const bytes = 'bytes' in file ? Reflect.get(file, 'bytes') : undefined;
    if (typeof path !== 'string') continue;
    parsedFiles.push({
      path,
      bytes: typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0,
    });
  }
  return { userId, documentId, files: parsedFiles, createdAt };
}

/**
 * Records these parts' files for deletion, inside the transaction that drops
 * them from the record. Returns the entry id, or null when there are no files.
 */
export function queueNarrationAudioDeletion(
  transaction: Transaction,
  userId: string,
  documentId: string,
  parts: NarrationPart[],
): string | null {
  const files = narrationAudioFiles(parts);
  if (!files.length) return null;
  const ref = getFirestore().collection(COLLECTION).doc();
  const entry: INarrationAudioDeletion = {
    userId,
    documentId,
    files,
    createdAt: new Date().toISOString(),
  };
  transaction.create(ref, entry);
  return ref.id;
}

/**
 * Deletes an entry's files, then gives their storage back and removes the
 * entry together. Throws when a delete fails; the entry is then kept and the
 * storage still counted, and a later run tries again.
 */
export async function processNarrationAudioDeletion(id: string): Promise<void> {
  const ref = deletionRef(id);
  const snapshot = await ref.get();
  const entry = snapshot.exists ? parseDeletion(snapshot.data()) : null;
  if (!entry) return;

  const bucket = DocumentService.getBucket();
  await Promise.all(
    entry.files.map((file) =>
      bucket.file(file.path).delete({ ignoreNotFound: true }),
    ),
  );

  const freedBytes = entry.files.reduce((sum, file) => sum + file.bytes, 0);
  await getFirestore().runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists) return;
    if (freedBytes > 0) {
      const usageRef = storageUsageDocRef(entry.userId);
      const usage = await transaction.get(usageRef);
      const used = usage.data()?.usedBytes;
      const usedBytes = typeof used === 'number' ? used : 0;
      transaction.set(
        usageRef,
        {
          usedBytes: Math.max(0, usedBytes - freedBytes),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    transaction.delete(ref);
  });
}

/** Processes an entry now if there is one; a failure is left to the sweep. */
export async function processNarrationAudioDeletionSoon(
  id: string | null,
): Promise<void> {
  if (!id) return;
  try {
    await processNarrationAudioDeletion(id);
  } catch (error) {
    logger.warn('Narration audio deletion left for the sweep', {
      deletionId: id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Retries entries an earlier attempt did not finish. Returns how many it finished. */
export async function sweepNarrationAudioDeletions(
  now = Date.now(),
  limit = 100,
): Promise<number> {
  const cutoff = new Date(
    now - NARRATION_AUDIO_DELETION_RETRY_MS,
  ).toISOString();
  const snapshot = await getFirestore()
    .collection(COLLECTION)
    .where('createdAt', '<', cutoff)
    .limit(limit)
    .get();
  let finished = 0;
  for (const doc of snapshot.docs) {
    try {
      await processNarrationAudioDeletion(doc.id);
      finished += 1;
    } catch (error) {
      logger.error('Narration audio deletion failed again', {
        deletionId: doc.id,
        message: error instanceof Error ? error.message : String(error),
      });
      // To the back of the queue, so entries that keep failing never block the rest.
      await doc.ref
        .update({
          createdAt: new Date().toISOString(),
          failures: FieldValue.increment(1),
        })
        .catch(() => undefined);
    }
  }
  return finished;
}
