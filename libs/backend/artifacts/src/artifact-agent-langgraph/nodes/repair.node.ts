/** LangGraph node: repair gate failures in the draft. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'repair';

export type RepairNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: repair gate failures in the draft.
 *
 * The repair node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must remain stable across the repair loop. See the P6 audit fix.
 *
 * P1 audit fix: explicitly increment `repair_iteration_count` on every visit
 * so the conditional edge after `gate` can enforce the maximum repair bound
 * (4 iterations) without relying solely on `recursionLimit`. The counter is
 * always returned as a finite number so the `incrementCounter` reducer on the
 * state channel preserves the new value.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`. The
 * `iteration` field on the log carries the `repair_iteration_count` value
 * the node is about to write (post-increment) so operators can correlate log
 * lines with the conditional-edge routing decisions.
 */
export async function repairNode(
  state: typeof DiagramQuizState.State
): Promise<RepairNodeResult> {
  const previousRepairCount = state.repair_iteration_count ?? 0;
  const nextRepairCount = previousRepairCount + 1;
  logNodeEnter(NODE_NAME, state, nextRepairCount);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    const failures = state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures];
    if (!definition) {
      throw new Error('Repair node requires artifact_definition in state');
    }
    if (draft === undefined) {
      throw new Error('Repair node requires artifact_draft in state');
    }

    if (!failures?.length) {
      // Nothing to repair, but still record the visit so the counter
      // reflects every node execution that the conditional edge considers.
      const result: RepairNodeResult = {
        repair_iteration_count: nextRepairCount,
      };
      logNodeExitOk(NODE_NAME, state, nextRepairCount);
      return result;
    }

    const repairedDraft = await definition.repair(draft, failures);

    const result: RepairNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: repairedDraft,
      repair_iteration_count: nextRepairCount,
    };
    logNodeExitOk(NODE_NAME, state, nextRepairCount);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err, nextRepairCount);
    throw err;
  }
}

export default repairNode;
