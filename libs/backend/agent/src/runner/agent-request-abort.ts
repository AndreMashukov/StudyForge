export class AgentRequestAbortedError extends Error {
  constructor(message = 'Agent request was aborted') {
    super(message);
    this.name = 'AgentRequestAbortedError';
  }
}

export function throwIfAgentRequestAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AgentRequestAbortedError();
  }
}

export function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'aborted' in value &&
    typeof (value as AbortSignal).aborted === 'boolean'
  );
}

/** Why a durable agent turn was aborted (passed as `AbortController.abort(reason)`). */
export type AgentTurnAbortReason = 'cancel' | 'deadline' | 'superseded';

const AGENT_TURN_ABORT_REASONS: ReadonlySet<string> = new Set([
  'cancel',
  'deadline',
  'superseded',
]);

export function isAgentTurnAbortReason(
  value: unknown,
): value is AgentTurnAbortReason {
  return typeof value === 'string' && AGENT_TURN_ABORT_REASONS.has(value);
}

/** Reads the turn abort reason; an abort without a known reason counts as a cancel. */
export function readAgentTurnAbortReason(
  signal?: AbortSignal,
): AgentTurnAbortReason | null {
  if (!signal?.aborted) {
    return null;
  }
  const reason: unknown = signal.reason;
  return isAgentTurnAbortReason(reason) ? reason : 'cancel';
}
