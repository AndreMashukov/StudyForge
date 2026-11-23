import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  createRuleFromBlueprint,
  getRuleBlueprint,
} from '@study-forge/backend-directories/rule-blueprints';

/** What a starter-course turn knows about the account's free course. */
export interface IStarterCourseRuntime {
  threadId: string;
  /**
   * `ask`: the first starter turn, which only asks clarifying questions.
   * `build`: later turns, which create the folder and documents.
   */
  phase: StarterCoursePhase;
  /** The instant sample folder; the course must not go there. */
  sampleDirectoryId?: string;
  /** The course folder, once the agent created it. */
  directoryId?: string;
  /** Free documents still available. */
  documentsRemaining: number;
  /** Every earlier starter document failed; this turn recreates them. */
  isRetry?: boolean;
}

export type StarterCoursePhase = 'ask' | 'build';

/**
 * The first starter turn asks questions; the course is built after the user
 * answers. A course that already has a folder or documents is past asking.
 */
export function resolveStarterCoursePhase(starter: {
  turnsUsed: number;
  documentsUsed: number;
  directoryId?: string;
}): StarterCoursePhase {
  return starter.turnsUsed <= 1 &&
    starter.documentsUsed === 0 &&
    !starter.directoryId
    ? 'ask'
    : 'build';
}

/**
 * Tools hidden in starter turns: the quiz is created automatically once the
 * documents are ready, and flashcards are off on the Free plan.
 */
export const STARTER_COURSE_HIDDEN_TOOLS: ReadonlySet<string> = new Set([
  'generate_quiz',
  'generate_flashcards',
]);

/** Also hidden while asking, so nothing is generated before the answers. */
export const STARTER_COURSE_ASK_HIDDEN_TOOLS: ReadonlySet<string> = new Set([
  ...STARTER_COURSE_HIDDEN_TOOLS,
  'create_directory',
  'create_document',
]);

/** Whether a tool is available in a starter turn of the given phase. */
export function isStarterCourseToolAvailable(
  toolName: string,
  phase: StarterCoursePhase,
): boolean {
  const hidden =
    phase === 'ask' ? STARTER_COURSE_ASK_HIDDEN_TOOLS : STARTER_COURSE_HIDDEN_TOOLS;
  return !hidden.has(toolName);
}

/** Published blueprints copied onto the course folder when they exist. */
export const STARTER_COURSE_BLUEPRINT_IDS = [
  'bp-doc-html-format',
  'bp-quiz-generic',
] as const;

/** Longest generation cooldown the agent waits out instead of failing. */
export const STARTER_COOLDOWN_MAX_WAIT_SECONDS = 15;

/**
 * Seconds to wait when a generation call hit a short cooldown, or undefined
 * when the error is anything else (or the wait would be too long).
 */
export function readShortCooldownSeconds(error: unknown): number | undefined {
  if (!(error instanceof HttpsError) || error.code !== 'resource-exhausted') {
    return undefined;
  }
  const details: unknown = error.details;
  if (typeof details !== 'object' || details === null) {
    return undefined;
  }
  const retryAfter: unknown = Reflect.get(details, 'retryAfterSeconds');
  if (
    typeof retryAfter !== 'number' ||
    !Number.isFinite(retryAfter) ||
    retryAfter <= 0 ||
    retryAfter > STARTER_COOLDOWN_MAX_WAIT_SECONDS
  ) {
    return undefined;
  }
  return retryAfter;
}

/** Waits for the cooldown, ending early (with an error) if the turn is aborted. */
export function waitForCooldown(
  seconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, seconds * 1000);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Copies the document and quiz formatting rules from published blueprints
 * onto the course folder, so the first generated documents look like the
 * rest of the product. Missing blueprints are skipped; failures never block
 * the course.
 */
export async function attachStarterCourseRules(
  userId: string,
  directoryId: string,
): Promise<string[]> {
  const attached: string[] = [];
  for (const blueprintId of STARTER_COURSE_BLUEPRINT_IDS) {
    try {
      const blueprint = await getRuleBlueprint(blueprintId);
      if (!blueprint || blueprint.status !== 'published') {
        continue;
      }
      const rule = await createRuleFromBlueprint(userId, {
        blueprintId,
        name: blueprint.name,
        content: blueprint.content,
        directoryId,
      });
      attached.push(rule.id);
    } catch (error) {
      logger.warn('Could not attach a starter course rule', {
        userId,
        directoryId,
        blueprintId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return attached;
}
