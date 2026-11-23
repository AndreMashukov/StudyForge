import { z } from 'zod';

/**
 * First-run onboarding for new accounts: a "What do you want to study?"
 * screen, a free starter course built by the workspace agent, and an instant
 * sample folder. Stored on users/{uid}.onboarding and written only by the
 * server. Accounts without this field are existing accounts and never see the
 * flow.
 */
export const USER_ONBOARDING_VERSION = 1;

/** What one account's free starter course may use. */
export const STARTER_COURSE_LIMITS = {
  /** Agent turns on the starter thread, including answers to questions. */
  maxTurns: 4,
  /** Documents the agent may create for free. */
  maxDocuments: 2,
  /** Quizzes created automatically once the documents are ready. */
  maxQuizzes: 1,
  /** Longest subject kept on the account. */
  maxSubjectChars: 200,
} as const;

/** Error code `startAgentTurn` returns when a starter turn is not allowed. */
export const STARTER_COURSE_UNAVAILABLE_CODE = 'STARTER_COURSE_UNAVAILABLE';

export const userOnboardingStatusSchema = z.enum([
  /** New account; the welcome screen has not been used yet. */
  'pending',
  /** The starter course is being built. */
  'started',
  /** The starter course finished (documents done and the quiz queued). */
  'completed',
  /** The user chose to skip the welcome screen. */
  'skipped',
]);

export type UserOnboardingStatus = z.output<typeof userOnboardingStatusSchema>;

export const starterCourseStateSchema = z.object({
  threadId: z.string().trim().min(1).optional(),
  turnsUsed: z.number().int().nonnegative().default(0),
  documentsUsed: z.number().int().nonnegative().default(0),
  /** The course folder the agent created. */
  directoryId: z.string().trim().min(1).optional(),
  documentIds: z.array(z.string().trim().min(1)).default([]),
  quizClaimedAt: z.string().optional(),
  quizId: z.string().trim().min(1).optional(),
});

export type StarterCourseState = z.output<typeof starterCourseStateSchema>;

export const userOnboardingSchema = z.object({
  version: z.number().int().positive().default(USER_ONBOARDING_VERSION),
  status: userOnboardingStatusSchema,
  /** What the user said they want to study. */
  subject: z.string().optional(),
  /** The instant sample folder, once it has been created. */
  sampleDirectoryId: z.string().trim().min(1).optional(),
  sampleClaimedAt: z.string().optional(),
  createdAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  skippedAt: z.string().optional(),
  starter: starterCourseStateSchema.default({
    turnsUsed: 0,
    documentsUsed: 0,
    documentIds: [],
  }),
});

export type UserOnboarding = z.output<typeof userOnboardingSchema>;

/** Parses users/{uid}.onboarding; missing or malformed means an existing account. */
export function parseUserOnboarding(value: unknown): UserOnboarding | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = userOnboardingSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** True while the account should be sent to the welcome screen. */
export function isOnboardingPending(
  onboarding: UserOnboarding | undefined,
): boolean {
  return onboarding?.status === 'pending';
}

/** Subject chips offered on the welcome screen. */
export const STARTER_COURSE_SUBJECT_SUGGESTIONS = [
  'Python programming',
  'Spanish for beginners',
  'World War II history',
  'Organic chemistry',
  'Personal finance',
  'Machine learning basics',
] as const;

export interface ISkipOnboardingResponse {
  onboarding: UserOnboarding;
}
