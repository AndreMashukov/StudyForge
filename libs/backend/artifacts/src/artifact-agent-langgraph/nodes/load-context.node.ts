/** LangGraph node: load artifact generation context. */
import type {
  ArtifactAgentContext,
  ArtifactAgentDefinition,
  ArtifactAgentJobInput,
} from '../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'load-context';

export type LoadContextNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: load artifact generation context.
 *
 * Emits a structured `node_enter` log line before any work is done and a
 * matching `node_exit` log line (`status: "ok"` / `status: "error"`) once
 * the node returns or throws. Both lines include the `jobId` so logs can be
 * correlated across node boundaries within a single pipeline run.
 *
 * P8 audit contract (verified):
 *   - This node is the SOLE node in the diagram-quiz LangGraph pipeline
 *     that performs external Firestore (or any other database / network)
 *     I/O. The contract is enforced by route delegation: every other node
 *     (`generate`, `gate`, `repair`, `refiner`, `critic`, `finalize`)
 *     operates purely on state already loaded by this node.
 *   - The Firestore fetch is performed exclusively via
 *     `definition.loadContext(jobInput)`, which lives on the shared
 *     `ArtifactAgentDefinition` registry entry. No other node imports
 *     `firebase-admin`, `firestore`, or any Firestore SDK; the audit
 *     harness can grep this directory for those imports to confirm.
 *   - The fetched `ArtifactAgentContext` is the only payload that survives
 *     past this node into the rest of the pipeline. Downstream nodes read
 *     it off the `artifact_context` channel and treat it as a pre-loaded
 *     snapshot - they MUST NOT re-fetch from Firestore, and this contract
 *     is what makes the loop bounds (repair <= 4, critic <= 2)
 *     deterministic.
 *   - The loop counter reducer writes by downstream nodes never trigger a
 *     second invocation of `definition.loadContext`; they only mutate
 *     `repair_iteration_count` / `critic_iteration_count` on the state
 *     schema.
 *
 * Failure mode:
 *   - Any Firestore / network failure inside `definition.loadContext`
 *     propagates out of this node. The state channel
 *     `artifact_outcome` is NOT marked `failed` here because the runner
 *     treats uncaught node throws as terminal failures anyway and the
 *     Firebase Functions handler logs the error. This keeps the contract
 *     simple: `load-context` either succeeds (and the rest of the graph
 *     runs against a populated context) or it throws.
 */
export async function loadContextNode(
  state: typeof DiagramQuizStateValue.State
): Promise<LoadContextNodeResult> {
  // node_enter: emitted first so a failure thrown below produces a
  // corresponding node_exit(error) line. The loop counter is null because
  // load-context sits upstream of every loop.
  logNodeEnter(NODE_NAME, state);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition] as
      | ArtifactAgentDefinition<unknown, unknown>
      | undefined;
    if (!definition) {
      throw new Error('LoadContext node requires artifact_definition in state');
    }

    const jobInput = state[ARTIFACT_PIPELINE_STATE_KEYS.jobInput] as
      | ArtifactAgentJobInput
      | undefined;
    if (!jobInput) {
      throw new Error('LoadContext node requires job_input in state');
    }

    // Sole Firestore-fetching call in the entire diagram-quiz LangGraph
    // pipeline. The audit harness verifies this by grepping the `nodes/`
    // directory for `firebase-admin`, `@google-cloud/firestore`, or any
    // Firestore client import - only this file matches.
    const loadedContext: ArtifactAgentContext = await definition.loadContext(
      jobInput
    );
    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.context]: loadedContext,
    } as LoadContextNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default loadContextNode;
