import { logger } from 'firebase-functions/v2';
import { STARTER_COURSE_LIMITS } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  decideStarterQuiz,
  type StarterDocumentState,
} from '@study-forge/backend-core/services/user-onboarding-logic';
import {
  claimStarterCourseQuiz,
  completeStarterCourse,
  getUserOnboarding,
} from '@study-forge/backend-core/services/user-onboarding-service';
import {
  createPendingQuiz,
  failPendingQuiz,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { enqueueGenerationJob } from './generation-enqueue';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from './generation-limits';
import type { GenerationJob } from './generation-jobs';

function toStarterDocumentState(value: unknown): StarterDocumentState {
  return value === 'completed' || value === 'failed' ? value : 'pending';
}

interface IStarterDocument {
  id: string;
  title: string;
  directoryId?: string;
  color?: string;
}

async function readStarterDocuments(
  userId: string,
  documentIds: string[],
): Promise<{
  states: Record<string, StarterDocumentState>;
  documents: Map<string, IStarterDocument>;
}> {
  const refs = documentIds.map((id) => FirestorePaths.document(userId, id));
  const snapshots =
    refs.length > 0 ? await refs[0].firestore.getAll(...refs) : [];
  const states: Record<string, StarterDocumentState> = {};
  const documents = new Map<string, IStarterDocument>();
  for (const snapshot of snapshots) {
    if (!snapshot.exists) {
      states[snapshot.id] = 'failed';
      continue;
    }
    states[snapshot.id] = toStarterDocumentState(
      snapshot.get('generationStatus'),
    );
    const title: unknown = snapshot.get('title');
    const directoryId: unknown = snapshot.get('directoryId');
    const color: unknown = snapshot.get('color');
    documents.set(snapshot.id, {
      id: snapshot.id,
      title: typeof title === 'string' && title.trim() ? title : 'Document',
      ...(typeof directoryId === 'string' && directoryId
        ? { directoryId }
        : {}),
      ...(typeof color === 'string' && color ? { color } : {}),
    });
  }
  return { states, documents };
}

/**
 * After a starter-course document finishes (or fails), queues the free
 * starter quiz once every starter document is done and at least one
 * succeeded. The quiz needs finished documents, so the agent cannot create it
 * in the same turn. Safe to call for any job: it returns early unless the job
 * belongs to the starter course, and the quiz is claimed transactionally.
 */
export async function maybeStartStarterCourseQuiz(
  job: GenerationJob,
  outcome: 'completed' | 'failed',
): Promise<void> {
  if (job.kind !== 'documentFromPrompt') {
    return;
  }
  const onboarding = await getUserOnboarding(job.userId);
  if (
    !onboarding ||
    onboarding.status !== 'started' ||
    !onboarding.starter.documentIds.includes(job.recordId)
  ) {
    return;
  }

  const { states, documents } = await readStarterDocuments(
    job.userId,
    onboarding.starter.documentIds,
  );
  // The job's own record may not be written yet; trust the job outcome.
  states[job.recordId] = outcome;

  const decision = decideStarterQuiz({ onboarding, documentStates: states });
  if (decision.type !== 'create') {
    if (decision.type === 'skip' && decision.reason === 'no_documents') {
      await completeStarterCourse(job.userId, undefined);
    }
    return;
  }

  const claimed = await claimStarterCourseQuiz(job.userId);
  if (!claimed) {
    return;
  }

  const sourceDocuments = decision.documentIds.flatMap((id) => {
    const document = documents.get(id);
    return document ? [document] : [];
  });
  const [first] = sourceDocuments;
  const directoryId =
    onboarding.starter.directoryId ?? first?.directoryId ?? job.directoryId;
  if (!first || !directoryId) {
    await completeStarterCourse(job.userId, undefined);
    return;
  }

  const subject = onboarding.subject?.trim();
  const title = subject ? `${subject} - starter quiz` : `${first.title} quiz`;
  const documentIds = sourceDocuments.map((document) => document.id);

  const reservation = await enforceCallableGenerationLimits(
    job.userId,
    'quiz',
    undefined,
    { waiver: { reason: 'starter_course' } },
  );
  let quizId: string | undefined;
  try {
    const colors = sourceDocuments.flatMap((document) =>
      document.color ? [document.color] : [],
    );
    quizId = await createPendingQuiz({
      userId: job.userId,
      directoryId,
      documentId: first.id,
      documentIds,
      documentTitle: first.title,
      title,
      ...(first.color ? { documentColor: first.color } : {}),
      ...(colors.length > 0 ? { documentColors: colors } : {}),
    });
    await enqueueGenerationJob({
      userId: job.userId,
      directoryId,
      recordId: quizId,
      kind: 'quiz',
      usageReservationId: reservation.id,
      // The quiz processor reads the name from quizName; the question
      // count comes from the quiz rules.
      payload: {
        documentIds,
        quizName: title,
      },
    });
    await completeStarterCourse(job.userId, quizId);
    logger.info('Starter course quiz queued', {
      userId: job.userId,
      quizId,
      documentCount: documentIds.length,
      maxQuizzes: STARTER_COURSE_LIMITS.maxQuizzes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (quizId) {
      await failPendingQuiz(job.userId, quizId, message).catch(() => undefined);
    }
    await refundUsageReservationSafe(job.userId, reservation.id);
    throw error;
  }
}

/** Never lets the follow-up break job settlement. */
export async function maybeStartStarterCourseQuizSafe(
  job: GenerationJob,
  outcome: 'completed' | 'failed',
): Promise<void> {
  try {
    await maybeStartStarterCourseQuiz(job, outcome);
  } catch (error) {
    logger.error('Starter course quiz follow-up failed', {
      userId: job.userId,
      jobId: job.id,
      recordId: job.recordId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
