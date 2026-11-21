import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { narrationCreditUnits } from '@shared-types';
import {
  resolveUserUsageLimitsContext,
  settleUsageReservationToCredits,
} from '@study-forge/backend-core/services/usage-limits-service';
import { storageUsageDocRef } from '@study-forge/backend-core/services/usage-quota-service';
import { DocumentService } from '../document-storage';
import { unpublishedNarrationUploads } from './narration-planning';
import { readNarrationRecord } from './narration-store';

/**
 * One generation run of a narration, kept apart from the narration record so
 * it survives the record being removed. It holds what the run reserved and
 * what it stored, and is settled exactly once: credits for the spoken text it
 * stored, storage for the bytes it stored, the rest given back. Settling
 * deletes the document, so a late or repeated settle finds nothing to do.
 *
 * `narrationRuns/{runId}` — server only.
 */
export interface INarrationRun {
  userId: string;
  documentId: string;
  reservationId?: string;
  reservedStorageBytes: number;
  /** Spoken characters and audio bytes of the parts this run stored. */
  generatedCharCount: number;
  storedBytes: number;
  /**
   * Every audio file the run uploaded, recorded before the upload. Settling
   * deletes the ones the narration does not refer to, so a part whose ready
   * update never committed leaves no file behind.
   */
  uploadedPaths: string[];
  /**
   * Credits per narration unit, fixed when the run was confirmed, so a price
   * change while it runs does not change what it is charged. Runs started
   * before this was recorded have none and settle at the current price.
   */
  creditCostPerUnit?: number;
  status: 'open';
  startedAt: string;
}

/** Open runs older than this are settled by the sweep; a run's task times out at 540s. */
export const NARRATION_RUN_STALE_MS = 15 * 60_000;

export function narrationRunRef(runId: string) {
  return getFirestore().collection('narrationRuns').doc(runId);
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function parseNarrationRun(data: unknown): INarrationRun | null {
  if (typeof data !== 'object' || data === null) return null;
  const read = (key: string) =>
    key in data ? Reflect.get(data, key) : undefined;
  const userId = read('userId');
  const documentId = read('documentId');
  const status = read('status');
  const startedAt = read('startedAt');
  const reservationId = read('reservationId');
  const creditCostPerUnit = read('creditCostPerUnit');
  if (
    typeof userId !== 'string' ||
    typeof documentId !== 'string' ||
    status !== 'open' ||
    typeof startedAt !== 'string'
  ) {
    return null;
  }
  return {
    userId,
    documentId,
    ...(typeof reservationId === 'string' ? { reservationId } : {}),
    reservedStorageBytes: readNumber(read('reservedStorageBytes')),
    generatedCharCount: readNumber(read('generatedCharCount')),
    storedBytes: readNumber(read('storedBytes')),
    uploadedPaths: readStrings(read('uploadedPaths')),
    ...(typeof creditCostPerUnit === 'number' &&
    Number.isFinite(creditCostPerUnit)
      ? { creditCostPerUnit: Math.max(0, creditCostPerUnit) }
      : {}),
    status,
    startedAt,
  };
}

/** Records an audio file on its run before it is uploaded. */
export async function trackNarrationRunUpload(
  runId: string,
  storagePath: string,
): Promise<void> {
  await narrationRunRef(runId).update({
    uploadedPaths: FieldValue.arrayUnion(storagePath),
  });
}

/**
 * Deletes the run's uploads the narration does not refer to. The record is
 * read after the run released the narration, so a ready update that committed
 * is seen and its file kept. Throws when a delete fails, leaving the run open
 * for the sweep to try again.
 */
async function deleteUnpublishedUploads(
  runId: string,
  run: INarrationRun,
): Promise<void> {
  if (!run.uploadedPaths.length) return;
  const record = await readNarrationRecord(run.userId, run.documentId);
  const unpublished = unpublishedNarrationUploads(
    run.uploadedPaths,
    record?.parts ?? [],
  );
  if (!unpublished.length) return;
  const bucket = DocumentService.getBucket();
  await Promise.all(
    unpublished.map((path) =>
      bucket.file(path).delete({ ignoreNotFound: true }),
    ),
  );
  logger.warn('Unpublished narration audio deleted', {
    runId,
    userId: run.userId,
    documentId: run.documentId,
    files: unpublished.length,
  });
}

/** Adds a stored part to the run's tallies; for use inside the part's transaction. */
export function narrationRunTallyUpdate(charCount: number, sizeBytes: number) {
  return {
    generatedCharCount: FieldValue.increment(charCount),
    storedBytes: FieldValue.increment(sizeBytes),
  };
}

async function creditsToCommit(run: INarrationRun): Promise<number> {
  let costPerUnit = run.creditCostPerUnit;
  if (costPerUnit === undefined) {
    const context = await resolveUserUsageLimitsContext(run.userId);
    costPerUnit = Math.max(
      0,
      context.setup.featurePolicies.documentNarration?.creditCost ?? 0,
    );
  }
  return narrationCreditUnits(run.generatedCharCount) * costPerUnit;
}

export type StaleRunTake =
  | { kind: 'taken'; run: INarrationRun }
  /** Claimed or refreshed since it was found stale: its worker is alive. */
  | { kind: 'active' }
  /** Already settled (its document is gone). */
  | { kind: 'missing' };

/**
 * Takes a run found stale for abandonment. The staleness is checked again and
 * the run is marked claimed in one transaction, so a worker that claims it in
 * the meantime either refreshed it (and it is left alone) or now finds it
 * claimed and stops.
 */
export async function takeStaleNarrationRun(
  runId: string,
  now = Date.now(),
): Promise<StaleRunTake> {
  const ref = narrationRunRef(runId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const run = snapshot.exists ? parseNarrationRun(snapshot.data()) : null;
    if (!run) return { kind: 'missing' };
    const started = Date.parse(run.startedAt);
    if (Number.isFinite(started) && now - started <= NARRATION_RUN_STALE_MS) {
      return { kind: 'active' };
    }
    const nowIso = new Date(now).toISOString();
    transaction.update(ref, {
      claimedAt: snapshot.get('claimedAt') ?? nowIso,
      abandonedAt: nowIso,
    });
    return { kind: 'taken', run };
  });
}

/**
 * Settles a run once. Credits are settled first (that call is idempotent: a
 * settled reservation is left alone), then one transaction marks the run
 * settled and moves the held storage to what was actually stored. A failure
 * leaves the run open, so the sweep settles it later.
 */
export async function settleNarrationRun(runId: string): Promise<void> {
  const ref = narrationRunRef(runId);
  const snapshot = await ref.get();
  const run = snapshot.exists ? parseNarrationRun(snapshot.data()) : null;
  if (!run) return;

  await deleteUnpublishedUploads(runId, run);

  if (run.reservationId) {
    // The reservation caps the commit at what was reserved.
    await settleUsageReservationToCredits(
      run.userId,
      run.reservationId,
      await creditsToCommit(run),
    );
  }

  await getFirestore().runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const latest = current.exists ? parseNarrationRun(current.data()) : null;
    if (!latest) return;
    const usageRef = storageUsageDocRef(latest.userId);
    const usage = await transaction.get(usageRef);
    const usedBytes = readNumber(usage.data()?.usedBytes);
    const deltaBytes = latest.storedBytes - latest.reservedStorageBytes;
    transaction.set(
      usageRef,
      {
        usedBytes: Math.max(0, usedBytes + deltaBytes),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    transaction.delete(ref);
  });
  logger.info('Narration run settled', {
    runId,
    userId: run.userId,
    documentId: run.documentId,
    generatedCharCount: run.generatedCharCount,
    storedBytes: run.storedBytes,
  });
}

/** Open runs whose worker should long have finished. */
export async function listStaleOpenNarrationRunIds(
  now = Date.now(),
  limit = 100,
): Promise<string[]> {
  const cutoff = new Date(now - NARRATION_RUN_STALE_MS).toISOString();
  const snapshot = await getFirestore()
    .collection('narrationRuns')
    .where('startedAt', '<', cutoff)
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.id);
}
