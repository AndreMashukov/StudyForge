import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computeExpiresAt } from '../lib/firestore-ttl';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  getJobStaleReferenceTime,
  isStaleByAge,
  STALE_PROCESSING_JOB_MS,
} from './generation-stale';
import { MAX_GENERATION_JOB_ATTEMPTS } from './generation-job-retry';

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

export interface GenerationJob {
  id: string;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  userId: string;
  directoryId: string;
  recordId: string;
  payloadStoragePath: string;
  attempts: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  failedAt?: Timestamp;
  error?: string;
  lastError?: string;
  lastRetryAt?: Timestamp;
}

export interface CreateGenerationJobParams {
  jobId: string;
  kind: GenerationJobKind;
  userId: string;
  directoryId: string;
  recordId: string;
  payloadStoragePath: string;
}

export type ClaimJobForProcessingResult =
  | { type: 'claimed'; job: GenerationJob }
  | { type: 'missing' }
  | { type: 'skip'; job: GenerationJob }
  | { type: 'failed_stale'; job: GenerationJob };

export class GenerationJobsService {
  static newJobId(userId: string): string {
    return FirestorePaths.generationJobs(userId).doc().id;
  }

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
    };

    await FirestorePaths.generationJob(params.userId, params.jobId).set({
      ...job,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return job;
  }

  static async getJob(userId: string, jobId: string): Promise<GenerationJob | null> {
    const snap = await FirestorePaths.generationJob(userId, jobId).get();
    if (!snap.exists) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as GenerationJob;
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

    const existingJob = { id: existingSnap.id, ...existingSnap.data() } as GenerationJob;

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