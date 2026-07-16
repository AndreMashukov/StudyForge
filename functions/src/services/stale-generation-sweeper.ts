import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { DocumentCrudService } from './document-crud';
import {
  failPendingDiagramQuiz,
  failPendingFlashcardSet,
  failPendingQuiz,
  failPendingSequenceQuiz,
  failPendingSlideDeck,
  failPendingSubjectWorld,
} from './artifact-generation-records';
import { failVisibleGenerationRecord } from './generation-job-failures';
import { GenerationJob, GenerationJobsService } from './generation-jobs';
import {
  getJobStaleReferenceTime,
  getRecordStaleReferenceTime,
  isStaleByAge,
  STALE_ORPHAN_PENDING_MS,
  STALE_PENDING_SWEEP_MESSAGE,
  STALE_PROCESSING_JOB_MS,
  staleCutoffTimestamp,
} from './generation-stale';
import { FirestorePaths } from '../lib/firestore-paths';

const SWEEP_PAGE_SIZE = 100;

export interface StaleGenerationSweepStats {
  staleJobsFailed: number;
  orphanDocumentsFailed: number;
  orphanQuizzesFailed: number;
  orphanFlashcardSetsFailed: number;
  orphanSlideDecksFailed: number;
  orphanDiagramQuizzesFailed: number;
  orphanSequenceQuizzesFailed: number;
  orphanSubjectWorldsFailed: number;
}

function parseUserIdFromPath(path: string): string | null {
  const match = path.match(/^users\/([^/]+)\//);
  return match?.[1] ?? null;
}

async function hasActiveGenerationJobForRecord(
  userId: string,
  recordId: string
): Promise<boolean> {
  const snap = await FirestorePaths.generationJobs(userId)
    .where('recordId', '==', recordId)
    .where('status', 'in', ['queued', 'processing'])
    .limit(1)
    .get();
  return !snap.empty;
}

async function failStaleGenerationJob(job: GenerationJob): Promise<void> {
  await failVisibleGenerationRecord(job, STALE_PENDING_SWEEP_MESSAGE).catch((error) => {
    logger.error('Sweeper failed to mark visible generation record as failed', {
      userId: job.userId,
      jobId: job.id,
      recordId: job.recordId,
      kind: job.kind,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await GenerationJobsService.markFailed(job.userId, job.id, STALE_PENDING_SWEEP_MESSAGE).catch((error) => {
    logger.error('Sweeper failed to mark generation job as failed', {
      userId: job.userId,
      jobId: job.id,
      recordId: job.recordId,
      kind: job.kind,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function sweepStaleGenerationJobs(nowMs: number): Promise<number> {
  const db = getFirestore();
  const cutoff = staleCutoffTimestamp(STALE_ORPHAN_PENDING_MS, nowMs);
  let failed = 0;

  const snap = await db
    .collectionGroup('generationJobs')
    .where('status', 'in', ['queued', 'processing'])
    .where('updatedAt', '<', cutoff)
    .limit(SWEEP_PAGE_SIZE)
    .get();

  for (const doc of snap.docs) {
    const job = { id: doc.id, ...doc.data() } as GenerationJob;
    const userId = job.userId ?? parseUserIdFromPath(doc.ref.path);
    if (!userId) {
      continue;
    }

    const referenceTime = getJobStaleReferenceTime(job);
    const staleThreshold = job.status === 'processing'
      ? STALE_PROCESSING_JOB_MS
      : STALE_ORPHAN_PENDING_MS;

    if (!isStaleByAge(referenceTime, staleThreshold, nowMs)) {
      continue;
    }

    logger.warn('Sweeping stale generation job', {
      userId,
      jobId: job.id,
      recordId: job.recordId,
      kind: job.kind,
      status: job.status,
      attempts: job.attempts,
    });

    await failStaleGenerationJob({ ...job, userId });
    failed += 1;
  }

  return failed;
}

async function failOrphanPendingRecord(
  userId: string,
  recordId: string,
  failFn: (userId: string, recordId: string, error: string) => Promise<void>
): Promise<boolean> {
  if (await hasActiveGenerationJobForRecord(userId, recordId)) {
    return false;
  }

  await failFn(userId, recordId, STALE_PENDING_SWEEP_MESSAGE);
  return true;
}

async function sweepOrphanPendingDocuments(nowMs: number): Promise<number> {
  const db = getFirestore();
  const cutoff = staleCutoffTimestamp(STALE_ORPHAN_PENDING_MS, nowMs);
  let failed = 0;

  const snap = await db
    .collectionGroup('documents')
    .where('generationStatus', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .limit(SWEEP_PAGE_SIZE)
    .get();

  for (const doc of snap.docs) {
    const userId = parseUserIdFromPath(doc.ref.path);
    if (!userId) {
      continue;
    }

    const data = doc.data() as { createdAt?: Timestamp };
    if (!isStaleByAge(getRecordStaleReferenceTime(data.createdAt), STALE_ORPHAN_PENDING_MS, nowMs)) {
      continue;
    }

    const didFail = await failOrphanPendingRecord(
      userId,
      doc.id,
      DocumentCrudService.failPendingDocument.bind(DocumentCrudService)
    );
    if (didFail) {
      logger.warn('Sweeping orphan pending document', { userId, documentId: doc.id });
      failed += 1;
    }
  }

  return failed;
}

async function sweepOrphanPendingArtifacts(
  collectionGroup: string,
  failFn: (userId: string, recordId: string, error: string) => Promise<void>,
  nowMs: number
): Promise<number> {
  const db = getFirestore();
  const cutoff = staleCutoffTimestamp(STALE_ORPHAN_PENDING_MS, nowMs);
  let failed = 0;

  const snap = await db
    .collectionGroup(collectionGroup)
    .where('generationStatus', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .limit(SWEEP_PAGE_SIZE)
    .get();

  for (const doc of snap.docs) {
    const userId = parseUserIdFromPath(doc.ref.path);
    if (!userId) {
      continue;
    }

    const data = doc.data() as { createdAt?: Timestamp };
    if (!isStaleByAge(getRecordStaleReferenceTime(data.createdAt), STALE_ORPHAN_PENDING_MS, nowMs)) {
      continue;
    }

    const didFail = await failOrphanPendingRecord(userId, doc.id, failFn);
    if (didFail) {
      logger.warn('Sweeping orphan pending artifact', {
        userId,
        collectionGroup,
        recordId: doc.id,
      });
      failed += 1;
    }
  }

  return failed;
}

export async function sweepStaleGenerations(): Promise<StaleGenerationSweepStats> {
  const nowMs = Date.now();
  const stats: StaleGenerationSweepStats = {
    staleJobsFailed: 0,
    orphanDocumentsFailed: 0,
    orphanQuizzesFailed: 0,
    orphanFlashcardSetsFailed: 0,
    orphanSlideDecksFailed: 0,
    orphanDiagramQuizzesFailed: 0,
    orphanSequenceQuizzesFailed: 0,
    orphanSubjectWorldsFailed: 0,
  };

  stats.staleJobsFailed = await sweepStaleGenerationJobs(nowMs);
  stats.orphanDocumentsFailed = await sweepOrphanPendingDocuments(nowMs);
  stats.orphanQuizzesFailed = await sweepOrphanPendingArtifacts('quizzes', failPendingQuiz, nowMs);
  stats.orphanFlashcardSetsFailed = await sweepOrphanPendingArtifacts(
    'flashcardSets',
    failPendingFlashcardSet,
    nowMs
  );
  stats.orphanSlideDecksFailed = await sweepOrphanPendingArtifacts('slideDecks', failPendingSlideDeck, nowMs);
  stats.orphanDiagramQuizzesFailed = await sweepOrphanPendingArtifacts(
    'diagramQuizzes',
    failPendingDiagramQuiz,
    nowMs
  );
  stats.orphanSequenceQuizzesFailed = await sweepOrphanPendingArtifacts(
    'sequenceQuizzes',
    failPendingSequenceQuiz,
    nowMs
  );
  stats.orphanSubjectWorldsFailed = await sweepOrphanPendingArtifacts(
    'subjectWorlds',
    failPendingSubjectWorld,
    nowMs
  );

  const total =
    stats.staleJobsFailed
    + stats.orphanDocumentsFailed
    + stats.orphanQuizzesFailed
    + stats.orphanFlashcardSetsFailed
    + stats.orphanSlideDecksFailed
    + stats.orphanDiagramQuizzesFailed
    + stats.orphanSequenceQuizzesFailed
    + stats.orphanSubjectWorldsFailed;

  if (total > 0) {
    logger.warn('Stale generation sweep completed', stats);
  } else {
    logger.info('Stale generation sweep completed with no stale records');
  }

  return stats;
}
