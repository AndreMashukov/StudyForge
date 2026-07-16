import { Timestamp } from 'firebase-admin/firestore';
import type { GenerationJob } from './generation-jobs';

/** Stale threshold for jobs stuck in `processing` (above 540s worker timeout). */
export const STALE_PROCESSING_JOB_MS = 15 * 60 * 1000;

/** Stale threshold for orphan pending records and jobs stuck in `queued`. */
export const STALE_ORPHAN_PENDING_MS = 20 * 60 * 1000;

export const STALE_PENDING_SWEEP_MESSAGE = 'Timed out — generation did not finish';

export function getJobStaleReferenceTime(job: GenerationJob): Date | null {
  if (job.startedAt) {
    return job.startedAt.toDate();
  }
  if (job.updatedAt) {
    return job.updatedAt.toDate();
  }
  if (job.createdAt) {
    return job.createdAt.toDate();
  }
  return null;
}

export function getRecordStaleReferenceTime(createdAt: Timestamp | undefined): Date | null {
  if (!createdAt) {
    return null;
  }
  return createdAt.toDate();
}

export function isStaleByAge(
  referenceTime: Date | null,
  staleMs: number,
  nowMs: number = Date.now()
): boolean {
  if (!referenceTime) {
    return false;
  }
  return nowMs - referenceTime.getTime() >= staleMs;
}

export function staleCutoffTimestamp(staleMs: number, nowMs: number = Date.now()): Timestamp {
  return Timestamp.fromMillis(nowMs - staleMs);
}
