import type { DirectoryChatState } from '../state';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../../directory-chat-pipeline-state-keys';

export type NodeLogEvent = 'node_enter' | 'node_exit';

export interface NodeLogContext {
  event: NodeLogEvent;
  node: string;
  threadId: string;
  status: 'ok' | 'error' | null;
  error: string | null;
  timestamp: string;
}

const STDOUT_WRITE = (line: string): void => {
  try {
    process.stdout.write(line + '\n');
  } catch {
    // Logging must never throw into a node body.
  }
};

const STDERR_WRITE = (line: string): void => {
  try {
    process.stderr.write(line + '\n');
  } catch {
    // Logging must never throw into a node body.
  }
};

export function resolveThreadId(state: DirectoryChatState): string {
  const threadId = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.threadId];
  return typeof threadId === 'string' && threadId.length > 0 ? threadId : 'unknown';
}

function emit(event: NodeLogEvent, context: NodeLogContext): void {
  const payload = JSON.stringify({
    event,
    node: context.node,
    threadId: context.threadId,
    status: context.status,
    error: context.error,
    timestamp: context.timestamp,
  });
  if (event === 'node_exit' && context.status === 'error') {
    STDERR_WRITE(payload);
  } else {
    STDOUT_WRITE(payload);
  }
}

export function logNodeEnter(node: string, state: DirectoryChatState): void {
  emit('node_enter', {
    event: 'node_enter',
    node,
    threadId: resolveThreadId(state),
    status: null,
    error: null,
    timestamp: new Date().toISOString(),
  });
}

export function logNodeExitOk(node: string, state: DirectoryChatState): void {
  emit('node_exit', {
    event: 'node_exit',
    node,
    threadId: resolveThreadId(state),
    status: 'ok',
    error: null,
    timestamp: new Date().toISOString(),
  });
}

export function logNodeExitError(
  node: string,
  state: DirectoryChatState,
  err: unknown
): void {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'unknown error';
  emit('node_exit', {
    event: 'node_exit',
    node,
    threadId: resolveThreadId(state),
    status: 'error',
    error: message,
    timestamp: new Date().toISOString(),
  });
}
