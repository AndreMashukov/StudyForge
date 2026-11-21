import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { narrationCreditUnits } from '@shared-types';
import {
  resolveUserUsageLimitsContext,
  settleUsageReservationToCredits,
} from '@study-forge/backend-core/services/usage-limits-service';
import { storageUsageDocRef } from '@study-forge/backend-core/services/usage-quota-service';

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

export function parseNarrationRun(data: unknown): INarrationRun | null {
  if (typeof data !== 'object' || data === null) return null;
  const read = (key: string) =>
    key in data ? Reflect.get(data, key) : undefined;
  const userId = read('userId');
  const documentId = read('documentId');
  const status = read('status');
  const startedAt = read('startedAt');
  const reservationId = read('reservationId');
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
    status,
    startedAt,
  };
}

/** Adds a stored part to the run's tallies; for use inside the part's transaction. */
export function narrationRunTallyUpdate(charCount: number, sizeBytes: number) {
  return {
    generatedCharCount: FieldValue.increment(charCount),
    storedBytes: FieldValue.increment(sizeBytes),
  };
}

async function creditsToCommit(run: INarrationRun): Promise<number> {
  const context = await resolveUserUsageLimitsContext(run.userId);
  const costPerUnit = Math.max(
    0,
    context.setup.featurePolicies.documentNarration?.creditCost ?? 0,
  );
  return narrationCreditUnits(run.generatedCharCount) * costPerUnit;
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
