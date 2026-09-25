import type { AgentPlanExecutePastStep } from '../runner/agent-plan-execute-helpers';
import type { AgentToolOutcome } from '../runner/agent-chat-fallback';

/** Max chat history entries kept in a workspace-agent checkpoint. */
export const CHECKPOINT_MAX_HISTORY_ENTRIES = 24;

/** Max executor past-step records kept in checkpoint state. */
export const CHECKPOINT_MAX_PAST_STEPS = 12;

/** Max tool outcome records kept in checkpoint state. */
export const CHECKPOINT_MAX_TOOL_OUTCOMES = 48;

/** Max characters for a single string field stored in checkpoint tool results. */
export const CHECKPOINT_MAX_TOOL_STRING_CHARS = 2_000;

/** Max characters for a past-step result blob. */
export const CHECKPOINT_MAX_PAST_STEP_RESULT_CHARS = 4_000;

function capLatest<T>(items: T[], max: number): T[] {
  if (items.length <= max) {
    return items;
  }
  return items.slice(items.length - max);
}

function truncateString(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[truncated for checkpoint storage]`;
}

function trimValueForCheckpoint(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[truncated: max depth]';
  }
  if (typeof value === 'string') {
    return truncateString(value, CHECKPOINT_MAX_TOOL_STRING_CHARS);
  }
  if (Array.isArray(value)) {
    const capped = value.slice(0, 40);
    return capped.map((entry) => trimValueForCheckpoint(entry, depth + 1));
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const trimmed: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      trimmed[key] = trimValueForCheckpoint(entry, depth + 1);
    }
    return trimmed;
  }
  return value;
}

export function trimToolOutcomeForCheckpoint(
  outcome: AgentToolOutcome,
): AgentToolOutcome {
  if (!outcome.ok || outcome.result === undefined) {
    return outcome;
  }
  return {
    ...outcome,
    result: trimValueForCheckpoint(outcome.result),
  };
}

export function trimToolOutcomesForCheckpoint(
  outcomes: AgentToolOutcome[],
): AgentToolOutcome[] {
  return capLatest(
    outcomes.map(trimToolOutcomeForCheckpoint),
    CHECKPOINT_MAX_TOOL_OUTCOMES,
  );
}

export function trimPastStepForCheckpoint(
  step: AgentPlanExecutePastStep,
): AgentPlanExecutePastStep {
  return {
    step: truncateString(step.step, 500),
    result: truncateString(step.result, CHECKPOINT_MAX_PAST_STEP_RESULT_CHARS),
  };
}

export function capPastStepsForCheckpoint(
  steps: AgentPlanExecutePastStep[],
): AgentPlanExecutePastStep[] {
  return capLatest(
    steps.map(trimPastStepForCheckpoint),
    CHECKPOINT_MAX_PAST_STEPS,
  );
}

export function capHistoryForCheckpoint(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return capLatest(
    history.map((entry) => ({
      role: entry.role,
      content: truncateString(entry.content, CHECKPOINT_MAX_TOOL_STRING_CHARS),
    })),
    CHECKPOINT_MAX_HISTORY_ENTRIES,
  );
}

export function mergeCappedHistory(
  current: Array<{ role: 'user' | 'assistant'; content: string }>,
  update: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return capHistoryForCheckpoint(current.concat(update));
}

export function mergeCappedPastSteps(
  current: AgentPlanExecutePastStep[],
  update: AgentPlanExecutePastStep[],
): AgentPlanExecutePastStep[] {
  return capPastStepsForCheckpoint(current.concat(update));
}

export function mergeCappedToolOutcomes(
  current: AgentToolOutcome[],
  update: AgentToolOutcome[],
): AgentToolOutcome[] {
  return trimToolOutcomesForCheckpoint(current.concat(update));
}
