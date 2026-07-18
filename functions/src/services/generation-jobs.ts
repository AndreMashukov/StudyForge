import type { ArtifactKind } from '@shared-types';
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { computeExpiresAt } from '../lib/firestore-ttl';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  getJobStaleReferenceTime,
  isStaleByAge,
  STALE_ORPHAN_PENDING_MS,
  STALE_PROCESSING_JOB_MS,
} from './generation-stale';
import { MAX_GENERATION_JOB_ATTEMPTS } from './generation-job-retry';
import {
  isArtifactKind,
  recordRefForArtifactKind,
} from './artifact-agent/artifact-agent-record-paths';

export type GenerationJobKind =
  | 'documentFromPrompt'
  | 'documentFromScreenshot'
  | 'artifactAgent'
  | 'quiz'
  | 'flashcards'
  | 'sequenceQuiz'
  | 'slideDeck'
  | 'subjectWorld';
export type GenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

const GENERATION_JOB_KINDS: ReadonlySet<string> = new Set([
  'documentFromPrompt',
  'documentFromScreenshot',
  'artifactAgent',
  'quiz',
  'flashcards',
  'sequenceQuiz',
  'slideDeck',
  'subjectWorld',
]);

const GENERATION_JOB_STATUSES: ReadonlySet<string> = new Set([
  'queued',
  'processing',
  'completed',
  'failed',
]);

export interface GenerationJob {
  id: string;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  userId: string;
  directoryId: string;
  recordId: string;
  payloadStoragePath: string;
  attempts: number;
  /** Present when kind is artifactAgent — selects the pending record collection. */
  artifactKind?: ArtifactKind;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  failedAt?: Timestamp;
  error?: string;
  lastError?: string;
  lastRetryAt?: Timestamp;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalTimestamp(
  value: unknown
): { ok: true; value?: Timestamp } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (value instanceof Timestamp) {
    return { ok: true, value };
  }
  return { ok: false };
}

function parseOptionalString(
  value: unknown
): { ok: true; value?: string } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value === 'string') {
    return { ok: true, value };
  }
  return { ok: false };
}

function isGenerationJobKind(value: string): value is GenerationJobKind {
  return GENERATION_JOB_KINDS.has(value);
}

function isGenerationJobStatus(value: string): value is GenerationJobStatus {
  return GENERATION_JOB_STATUSES.has(value);
}

/**
 * Validate Firestore job document data before treating it as GenerationJob.
 * Rejects missing/malformed required fields (same style as LLM repository parsers).
 */
export function parseGenerationJob(id: string, data: unknown): GenerationJob | null {
  if (!isRecord(data)) {
    return null;
  }

  if (typeof data.kind !== 'string' || !isGenerationJobKind(data.kind)) {
    return null;
  }
  if (typeof data.status !== 'string' || !isGenerationJobStatus(data.status)) {
    return null;
  }
  if (typeof data.userId !== 'string' || data.userId.trim().length === 0) {
    return null;
  }
  if (typeof data.directoryId !== 'string' || data.directoryId.trim().length === 0) {
    return null;
  }
  if (typeof data.recordId !== 'string' || data.recordId.trim().length === 0) {
    return null;
  }
  if (typeof data.payloadStoragePath !== 'string' || data.payloadStoragePath.trim().length === 0) {
    return null;
  }
  if (typeof data.attempts !== 'number' || !Number.isFinite(data.attempts) || data.attempts < 0) {
    return null;
  }

  const createdAt = parseOptionalTimestamp(data.createdAt);
  const updatedAt = parseOptionalTimestamp(data.updatedAt);
  const startedAt = parseOptionalTimestamp(data.startedAt);
  const completedAt = parseOptionalTimestamp(data.completedAt);
  const failedAt = parseOptionalTimestamp(data.failedAt);
  const lastRetryAt = parseOptionalTimestamp(data.lastRetryAt);
  if (
    !createdAt.ok
    || !updatedAt.ok
    || !startedAt.ok
    || !completedAt.ok
    || !failedAt.ok
    || !lastRetryAt.ok
  ) {
    return null;
  }

  const error = parseOptionalString(data.error);
  const lastError = parseOptionalString(data.lastError);
  if (!error.ok || !lastError.ok) {
    return null;
  }

  const artifactKind =
    typeof data.artifactKind === 'string' && isArtifactKind(data.artifactKind)
      ? data.artifactKind
      : undefined;

  return {
    id,
    kind: data.kind,
    status: data.status,
    userId: data.userId,
    directoryId: data.directoryId,
    recordId: data.recordId,
    payloadStoragePath: data.payloadStoragePath,
    attempts: data.attempts,
    ...(artifactKind ? { artifactKind } : {}),
    ...(createdAt.value ? { createdAt: createdAt.value } : {}),
    ...(updatedAt.value ? { updatedAt: updatedAt.value } : {}),
    ...(startedAt.value ? { startedAt: startedAt.value } : {}),
    ...(completedAt.value ? { completedAt: completedAt.value } : {}),
    ...(failedAt.value ? { failedAt: failedAt.value } : {}),
    ...(error.value !== undefined ? { error: error.value } : {}),
    ...(lastError.value !== undefined ? { lastError: lastError.value } : {}),
    ...(lastRetryAt.value ? { lastRetryAt: lastRetryAt.value } : {}),
  };
}

export interface CreateGenerationJobParams {
  jobId: string;
  kind: GenerationJobKind;
  userId: string;
  directoryId: string;
  recordId: string;
  payloadStoragePath: string;
  artifactKind?: ArtifactKind;
}

export type ClaimJobForProcessingResult =
  | { type: 'claimed'; job: GenerationJob }
  | { type: 'missing' }
  | { type: 'skip'; job: GenerationJob }
  | { type: 'failed_stale'; job: GenerationJob };

/** Thrown when createJob races with orphan sweep that already failed the record. */
export class GenerationRecordUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationRecordUnavailableError';
  }
}

export function recordRefForGenerationJob(
  userId: string,
  kind: GenerationJobKind,
  recordId: string,
  artifactKind?: ArtifactKind
): DocumentReference {
  switch (kind) {
    case 'documentFromPrompt':
    case 'documentFromScreenshot':
      return FirestorePaths.document(userId, recordId);
    case 'quiz':
      return FirestorePaths.quiz(userId, recordId);
    case 'flashcards':
      return FirestorePaths.flashcardSet(userId, recordId);
    case 'sequenceQuiz':
      return FirestorePaths.sequenceQuiz(userId, recordId);
    case 'slideDeck':
      return FirestorePaths.slideDeck(userId, recordId);
    case 'artifactAgent':
      return recordRefForArtifactKind(userId, artifactKind ?? 'diagramQuiz', recordId);
    case 'subjectWorld':
      return FirestorePaths.subjectWorld(userId, recordId);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unsupported generation job kind: ${_exhaustive}`);
    }
  }
}

export class GenerationJobsService {
  static newJobId(userId: string): string {
    return FirestorePaths.generationJobs(userId).doc().id;
  }

  /**
   * Creates a queued job and associates it with the pending record in one
   * transaction (`generationJobId` on the record). Serialized with orphan
   * sweep so a late fail cannot race past an actively created job.
   */
  static async createJob(params: CreateGenerationJobParams): Promise<GenerationJob> {
    const job: GenerationJob = {
      id: params.jobId,
      kind: params.kind,
      status: 'queued',
      userId: params.userId,
      directoryId: params.directoryId,
      recordId: params.recordId,
      payloadStoragePath: params.payloadStoragePath,
      attempts: 0,
      ...(params.artifactKind ? { artifactKind: params.artifactKind } : {}),
    };

    const jobRef = FirestorePaths.generationJob(params.userId, params.jobId);
    const recordRef = recordRefForGenerationJob(
      params.userId,
      params.kind,
      params.recordId,
      params.artifactKind
    );

    await jobRef.firestore.runTransaction(async (transaction) => {
      const recordSnap = await transaction.get(recordRef);
      if (!recordSnap.exists) {
        throw new GenerationRecordUnavailableError(
          `Pending generation record ${params.recordId} not found`
        );
      }

      const recordData = recordSnap.data() as { generationStatus?: string };
      if (recordData.generationStatus === 'failed') {
        throw new GenerationRecordUnavailableError(
          `Cannot create generation job for failed record ${params.recordId}`
        );
      }
      if (recordData.generationStatus === 'completed') {
        throw new GenerationRecordUnavailableError(
          `Cannot create generation job for completed record ${params.recordId}`
        );
      }

      transaction.set(jobRef, {
        ...job,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(recordRef, {
        generationJobId: params.jobId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return job;
  }

  static async getJob(userId: string, jobId: string): Promise<GenerationJob | null> {
    const snap = await FirestorePaths.generationJob(userId, jobId).get();
    if (!snap.exists) {
      return null;
    }
    return parseGenerationJob(snap.id, snap.data());
  }

  static async claimQueuedJob(userId: string, jobId: string): Promise<GenerationJob | null> {
    const result = await this.claimJobForProcessing(userId, jobId);
    if (result.type === 'claimed') {
      return result.job;
    }
    return null;
  }

  static async claimJobForProcessing(
    userId: string,
    jobId: string
  ): Promise<ClaimJobForProcessingResult> {
    const ref = FirestorePaths.generationJob(userId, jobId);
    const existingSnap = await ref.get();
    if (!existingSnap.exists) {
      return { type: 'missing' };
    }

    const existingJob = parseGenerationJob(existingSnap.id, existingSnap.data());
    if (!existingJob) {
      return { type: 'missing' };
    }

    if (existingJob.status === 'completed' || existingJob.status === 'failed') {
      return { type: 'skip', job: existingJob };
    }

    if (existingJob.status === 'processing') {
      const referenceTime = getJobStaleReferenceTime(existingJob);
      if (!isStaleByAge(referenceTime, STALE_PROCESSING_JOB_MS)) {
        return { type: 'skip', job: existingJob };
      }

      if (existingJob.attempts >= MAX_GENERATION_JOB_ATTEMPTS) {
        return { type: 'failed_stale', job: existingJob };
      }

      const reclaimed = await ref.firestore.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          return false;
        }

        const job = { id: snap.id, ...snap.data() } as GenerationJob;
        if (job.status !== 'processing') {
          return false;
        }

        const staleReferenceTime = getJobStaleReferenceTime(job);
        if (!isStaleByAge(staleReferenceTime, STALE_PROCESSING_JOB_MS)) {
          return false;
        }

        if (job.attempts >= MAX_GENERATION_JOB_ATTEMPTS) {
          return false;
        }

        transaction.update(ref, {
          status: 'processing',
          attempts: FieldValue.increment(1),
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastError: 'Reclaimed after stale processing timeout',
        });

        return true;
      });

      if (!reclaimed) {
        const latest = await this.getJob(userId, jobId);
        if (!latest) {
          return { type: 'missing' };
        }
        if (latest.status === 'completed' || latest.status === 'failed') {
          return { type: 'skip', job: latest };
        }
        if (
          latest.status === 'processing'
          && isStaleByAge(getJobStaleReferenceTime(latest), STALE_PROCESSING_JOB_MS)
          && latest.attempts >= MAX_GENERATION_JOB_ATTEMPTS
        ) {
          return { type: 'failed_stale', job: latest };
        }
        return { type: 'skip', job: latest };
      }

      const reclaimedJob = await this.getJob(userId, jobId);
      if (!reclaimedJob) {
        return { type: 'missing' };
      }
      return { type: 'claimed', job: reclaimedJob };
    }

    const claimed = await ref.firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        return false;
      }

      const job = { id: snap.id, ...snap.data() } as GenerationJob;
      if (job.status !== 'queued') {
        return false;
      }

      transaction.update(ref, {
        status: 'processing',
        attempts: FieldValue.increment(1),
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return true;
    });

    if (!claimed) {
      const latest = await this.getJob(userId, jobId);
      if (!latest) {
        return { type: 'missing' };
      }
      return { type: 'skip', job: latest };
    }

    const claimedJob = await this.getJob(userId, jobId);
    if (!claimedJob) {
      return { type: 'missing' };
    }
    return { type: 'claimed', job: claimedJob };
  }

  static async markCompleted(userId: string, jobId: string): Promise<void> {
    const terminalAt = new Date();
    await FirestorePaths.generationJob(userId, jobId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: computeExpiresAt(terminalAt, 'generationJob'),
    });
  }

  static async markFailed(userId: string, jobId: string, error: string): Promise<void> {
    const terminalAt = new Date();
    await FirestorePaths.generationJob(userId, jobId).update({
      status: 'failed',
      error,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: computeExpiresAt(terminalAt, 'generationJob'),
    });
  }

  /**
   * Atomically fail a job only if it is still queued/processing and stale.
   * Prevents overwriting concurrent claim/completion transitions.
   * Returns the job snapshot used for the transition, or null if skipped.
   */
  static async markFailedIfStale(
    userId: string,
    jobId: string,
    error: string,
    nowMs: number = Date.now()
  ): Promise<GenerationJob | null> {
    const ref = FirestorePaths.generationJob(userId, jobId);
    return ref.firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        return null;
      }

      const job = { id: snap.id, ...snap.data() } as GenerationJob;
      if (job.status !== 'queued' && job.status !== 'processing') {
        return null;
      }

      const staleThreshold = job.status === 'processing'
        ? STALE_PROCESSING_JOB_MS
        : STALE_ORPHAN_PENDING_MS;
      if (!isStaleByAge(getJobStaleReferenceTime(job), staleThreshold, nowMs)) {
        return null;
      }

      const terminalAt = new Date(nowMs);
      transaction.update(ref, {
        status: 'failed',
        error,
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: computeExpiresAt(terminalAt, 'generationJob'),
      });

      return job;
    });
  }

  static async markRetryableFailure(userId: string, jobId: string, error: string): Promise<void> {
    const ref = FirestorePaths.generationJob(userId, jobId);
    await ref.firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error(`Generation job ${jobId} not found`);
      }

      const job = { id: snap.id, ...snap.data() } as GenerationJob;
      if (job.status !== 'processing') {
        throw new Error(`Generation job ${jobId} is not processing`);
      }

      transaction.update(ref, {
        status: 'queued',
        lastError: error,
        lastRetryAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}