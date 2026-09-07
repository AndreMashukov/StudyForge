/**
 * Structured JSON logger for flashcards LangGraph nodes.
 *
 * Emits `node_enter` and `node_exit` log lines as a single JSON object per
 * line (matching the format the rest of the StudyForge backend uses for
 * structured logs in Cloud Logging). Each line carries:
 *
 *   - `event`:        `"node_enter" | "node_exit"`
 *   - `node`:         the LangGraph node name (`"load-context"`, etc.)
 *   - `jobId`:        the per-run job identifier, sourced from
 *                     `ArtifactAgentJobInput.jobId` or `ArtifactAgentContext.jobId`.
 *                     Falls back to `"unknown"` so the field is always present.
 *   - `artifactKind`: the artifact kind (e.g. `"flashcards"`).
 *   - `iteration`:    the iteration count relevant to the node, when
 *                     applicable (`repair_iteration_count` for repair),
 *                     otherwise `null`.
 *   - `status`:       `"ok" | "error"` on exit; `null` on enter.
 *   - `error`:        error message string on exit when `status === "error"`,
 *                     otherwise `null`.
 *   - `timestamp`:    ISO-8601 timestamp at the moment the line is emitted.
 *
 * The logger writes to `process.stdout` for `node_enter` and either
 * `process.stdout` (success) or `process.stderr` (error) for `node_exit`,
 * mirroring the conventions used elsewhere in the Firebase Functions runtime.
 * It never throws, so a logging failure can never break a pipeline run.
 *
 * Flashcards-specific notes:
 *   - The logger operates on `FlashcardsState` rather than
 *     `DiagramQuizState`. This is intentional: per Phase A of the migration
 *     spec, the two artifact kinds do not share nodes or state schemas,
 *     even when the logger contract is identical. Sharing a logger module
 *     would create a hidden coupling that the audit harness would not
 *     detect; duplicating the small file is cheaper than re-introducing
 *     coupling.
 */
import type { ArtifactKind } from '@shared-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';

export type NodeLogEvent = 'node_enter' | 'node_exit';

export interface NodeLogContext {
  node: string;
  jobId: string;
  artifactKind: ArtifactKind | string | undefined;
  iteration: number | null;
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

/**
 * Extract the jobId from the flashcards graph state. The job id is carried
 * on both `job_input` (the caller-provided input) and `artifact_context`
 * (produced by `load-context`). We prefer `job_input` because that channel
 * is the durable session-state seed and is guaranteed to be present from
 * the initial state; the context is only populated after `load-context`
 * runs.
 */
export function resolveJobId(state: FlashcardsState): string {
  const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput] as
    | { jobId?: string }
    | undefined;
  if (jobInput?.jobId) {
    return jobInput.jobId;
  }
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context] as
    | { jobId?: string }
    | undefined;
  if (context?.jobId) {
    return context.jobId;
  }
  return 'unknown';
}

/**
 * Resolve the artifact kind for a node log line. Sourced from the same
 * channels the diagnostic factory uses so the value matches the rest of
 * the audit pipeline.
 */
export function resolveArtifactKind(state: FlashcardsState): string {
  const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition] as
    | { artifactKind?: ArtifactKind }
    | undefined;
  if (definition?.artifactKind) {
    return definition.artifactKind;
  }
  const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput] as
    | { artifactKind?: ArtifactKind }
    | undefined;
  if (jobInput?.artifactKind) {
    return jobInput.artifactKind;
  }
  const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context] as
    | { artifactKind?: ArtifactKind }
    | undefined;
  if (context?.artifactKind) {
    return context.artifactKind;
  }
  return 'unknown';
}

function emit(event: NodeLogEvent, context: NodeLogContext): void {
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

/**
 * Build a `node_enter` log line for the named node against the current
 * state. `iteration` is the relevant loop counter for nodes that live
 * inside a loop (`repair` -> `repair_iteration_count`); other nodes pass
 * `null`.
 */
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

/**
 * Build a successful `node_exit` log line for the named node.
 */
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

/**
 * Build an error `node_exit` log line for the named node. Accepts either
 * an `Error` instance or a string message so call sites do not have to
 * convert.
 */
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

// Suppress an "unused" lint hint: some downstream graph factories reference
// the Annotation value rather than the inferred state type. Exporting it
// keeps the public surface of the module symmetric with the diagram-quiz
// counterpart.
export { FlashcardsStateValue };