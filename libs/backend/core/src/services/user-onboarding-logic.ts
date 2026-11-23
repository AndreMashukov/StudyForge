import type { AgentTurnIntent, UserOnboarding } from '@shared-types';
import { STARTER_COURSE_LIMITS } from '@shared-types';

/** Accounts older than this never get onboarding (legacy accounts without a profile doc). */
export const ONBOARDING_MAX_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Whether bootstrap should start onboarding: only for a profile created right
 * now, on a recent Auth account. Bootstrap runs on every sign-in, so an
 * existing profile always means "not new".
 */
export function decideOnboardingInit(params: {
  profileExists: boolean;
  authCreatedAtMs: number | undefined;
  nowMs: number;
}): boolean {
  if (params.profileExists) {
    return false;
  }
  if (params.authCreatedAtMs === undefined || !Number.isFinite(params.authCreatedAtMs)) {
    return false;
  }
  return params.nowMs - params.authCreatedAtMs <= ONBOARDING_MAX_ACCOUNT_AGE_MS;
}

export type StarterTurnDecision =
  | { type: 'begin' }
  | { type: 'continue' }
  | { type: 'none' }
  | { type: 'reject'; message: string };

function starterThreadHasRoom(
  onboarding: UserOnboarding,
  threadId: string,
): boolean {
  const starter = onboarding.starter;
  return (
    onboarding.status === 'started' &&
    starter.threadId === threadId &&
    starter.turnsUsed < STARTER_COURSE_LIMITS.maxTurns &&
    starter.documentsUsed < STARTER_COURSE_LIMITS.maxDocuments
  );
}

/**
 * Whether a new agent turn is part of the free starter course.
 * - `begin`: the first starter turn (only from a pending account).
 * - `continue`: a later turn on the starter thread while the allowance lasts,
 *   with or without the intent, so answering a question card stays free.
 * - `none`: an ordinary paid turn.
 * - `reject`: the client asked for the starter course but may not have it.
 */
export function decideStarterTurn(params: {
  onboarding: UserOnboarding | undefined;
  threadId: string;
  intent: AgentTurnIntent | undefined;
}): StarterTurnDecision {
  const { onboarding, threadId, intent } = params;

  if (intent === 'starter_course') {
    if (!onboarding) {
      return {
        type: 'reject',
        message: 'The starter course is only available to new accounts.',
      };
    }
    if (onboarding.status === 'pending') {
      return { type: 'begin' };
    }
    if (starterThreadHasRoom(onboarding, threadId)) {
      return { type: 'continue' };
    }
    return {
      type: 'reject',
      message: 'Your free starter course has already been used.',
    };
  }

  if (onboarding && starterThreadHasRoom(onboarding, threadId)) {
    return { type: 'continue' };
  }
  return { type: 'none' };
}

export type StarterDocumentClaimDecision =
  | { allowed: true }
  | { allowed: false; message: string };

/** Whether one more free starter document may be created on this thread. */
export function decideStarterDocumentClaim(params: {
  onboarding: UserOnboarding | undefined;
  threadId: string;
}): StarterDocumentClaimDecision {
  const { onboarding, threadId } = params;
  if (
    !onboarding ||
    onboarding.status !== 'started' ||
    onboarding.starter.threadId !== threadId
  ) {
    return {
      allowed: false,
      message: 'This conversation is not the starter course.',
    };
  }
  if (onboarding.starter.documentsUsed >= STARTER_COURSE_LIMITS.maxDocuments) {
    return {
      allowed: false,
      message: `The starter course already has its ${STARTER_COURSE_LIMITS.maxDocuments} free documents.`,
    };
  }
  return { allowed: true };
}

export type StarterDocumentState = 'pending' | 'completed' | 'failed';

export type StarterQuizDecision =
  | { type: 'wait' }
  | { type: 'create'; documentIds: string[] }
  | { type: 'skip'; reason: 'not_starter' | 'already_claimed' | 'no_documents' };

/**
 * Whether the starter quiz should be created now: once every starter document
 * has finished and at least one succeeded. It is created at most once.
 */
export function decideStarterQuiz(params: {
  onboarding: UserOnboarding | undefined;
  documentStates: Record<string, StarterDocumentState>;
}): StarterQuizDecision {
  const { onboarding, documentStates } = params;
  if (!onboarding || onboarding.status !== 'started') {
    return { type: 'skip', reason: 'not_starter' };
  }
  if (onboarding.starter.quizClaimedAt || onboarding.starter.quizId) {
    return { type: 'skip', reason: 'already_claimed' };
  }
  const documentIds = onboarding.starter.documentIds;
  // A claimed slot whose document is not recorded yet is still being queued.
  if (
    documentIds.length === 0 ||
    documentIds.length < onboarding.starter.documentsUsed
  ) {
    return { type: 'wait' };
  }
  const states = documentIds.map((id) => documentStates[id] ?? 'pending');
  if (states.some((state) => state === 'pending')) {
    return { type: 'wait' };
  }
  const completed = documentIds.filter(
    (id) => documentStates[id] === 'completed',
  );
  if (completed.length === 0) {
    return { type: 'skip', reason: 'no_documents' };
  }
  return { type: 'create', documentIds: completed };
}

/** Trims and shortens the subject before it is stored on the account. */
export function normalizeStarterSubject(subject: string): string {
  const trimmed = subject.trim().replace(/\s+/g, ' ');
  return trimmed.length > STARTER_COURSE_LIMITS.maxSubjectChars
    ? trimmed.slice(0, STARTER_COURSE_LIMITS.maxSubjectChars).trimEnd()
    : trimmed;
}

/** The onboarding state after a starter turn is accepted. */
export function applyStarterTurn(params: {
  onboarding: UserOnboarding;
  decision: 'begin' | 'continue';
  threadId: string;
  subject: string;
  nowIso: string;
}): UserOnboarding {
  const { onboarding, decision } = params;
  if (decision === 'begin') {
    return {
      ...onboarding,
      status: 'started',
      subject: normalizeStarterSubject(params.subject),
      startedAt: params.nowIso,
      starter: {
        ...onboarding.starter,
        threadId: params.threadId,
        turnsUsed: 1,
      },
    };
  }
  return {
    ...onboarding,
    starter: {
      ...onboarding.starter,
      turnsUsed: onboarding.starter.turnsUsed + 1,
    },
  };
}

/** Firestore rejects `undefined`, so optional fields are written only when set. */
export function serializeUserOnboarding(
  onboarding: UserOnboarding,
): Record<string, unknown> {
  const starter = onboarding.starter;
  const pick = (entries: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(entries).filter(([, value]) => value !== undefined),
    );
  return pick({
    version: onboarding.version,
    status: onboarding.status,
    subject: onboarding.subject,
    sampleDirectoryId: onboarding.sampleDirectoryId,
    sampleClaimedAt: onboarding.sampleClaimedAt,
    createdAt: onboarding.createdAt,
    startedAt: onboarding.startedAt,
    completedAt: onboarding.completedAt,
    skippedAt: onboarding.skippedAt,
    starter: pick({
      threadId: starter.threadId,
      turnsUsed: starter.turnsUsed,
      documentsUsed: starter.documentsUsed,
      directoryId: starter.directoryId,
      documentIds: starter.documentIds,
      quizClaimedAt: starter.quizClaimedAt,
      quizId: starter.quizId,
    }),
  });
}
