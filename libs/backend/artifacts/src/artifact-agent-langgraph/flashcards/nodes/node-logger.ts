import type { ArtifactKind } from '@shared-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';

export type NodeLogEvent = 'node_enter' | 'node_exit';

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

export function resolveJobId(state: FlashcardsState): string {
  const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput];
  if (jobInput?.jobId) {
    return jobInput.jobId;
  }
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  if (context?.jobId) {
    return context.jobId;
  }
  return 'unknown';
}

export function resolveArtifactKind(state: FlashcardsState): string {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
  if (definition?.artifactKind) {
    return definition.artifactKind;
  }
  const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput];
  if (jobInput?.artifactKind) {
    return jobInput.artifactKind;
  }
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
  if (context?.artifactKind) {
    return context.artifactKind;
  }
  return 'unknown';
}

function emit(
  event: NodeLogEvent,
  context: {
    node: string;
    jobId: string;
    artifactKind: ArtifactKind | string | undefined;
    iteration: number | null;
    status: 'ok' | 'error' | null;
    error: string | null;
    timestamp: string;
  }
): void {
  const payload = JSON.stringify({
    event,
    node: context.node,
    jobId: context.jobId,
    artifactKind: context.artifactKind,
    iteration: context.iteration,
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

export function logNodeEnter(
  node: string,
  state: FlashcardsState,
  iteration: number | null = null
): void {
  emit('node_enter', {
    node,
    jobId: resolveJobId(state),
    artifactKind: resolveArtifactKind(state),
    iteration,
    status: null,
    error: null,
    timestamp: new Date().toISOString(),
  });
}

export function logNodeExitOk(
  node: string,
  state: FlashcardsState,
  iteration: number | null = null
): void {
  emit('node_exit', {
    node,
    jobId: resolveJobId(state),
    artifactKind: resolveArtifactKind(state),
    iteration,
    status: 'ok',
    error: null,
    timestamp: new Date().toISOString(),
  });
}

export function logNodeExitError(
  node: string,
  state: FlashcardsState,
  err: unknown,
  iteration: number | null = null
): void {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'unknown error';
  emit('node_exit', {
    node,
    jobId: resolveJobId(state),
    artifactKind: resolveArtifactKind(state),
    iteration,
    status: 'error',
    error: message,
    timestamp: new Date().toISOString(),
  });
}
