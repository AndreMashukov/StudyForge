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
