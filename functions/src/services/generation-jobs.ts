import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FirestorePaths } from '../lib/firestore-paths';

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
    const ref = FirestorePaths.generationJob(userId, jobId);
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
      return null;
    }

    return this.getJob(userId, jobId);
  }

  static async markCompleted(userId: string, jobId: string): Promise<void> {
    await FirestorePaths.generationJob(userId, jobId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  static async markFailed(userId: string, jobId: string, error: string): Promise<void> {
    await FirestorePaths.generationJob(userId, jobId).update({
      status: 'failed',
      error,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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