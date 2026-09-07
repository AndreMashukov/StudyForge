/** LangGraph node: repair gate failures in the flashcards draft. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../../artifact-pipeline-state-keys';
import { FlashcardsStateValue } from '../flashcards-state';
import type { FlashcardsState } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'repair';

export type RepairNodeResult = Partial<FlashcardsState>;

/**
 * LangGraph node: repair gate failures in the flashcards draft.
 *
 * The repair node does NOT write `artifact_generation_model` or
 * `artifact_agent_model`. Those keys are set exclusively by `generate.node.ts`
 * and must remain stable across the repair loop. See the P6 audit fix.
 *
 * P1 audit fix: explicitly increment `repair_iteration_count` on every
 * visit so the conditional edge after `gate` can enforce the maximum
 * repair bound (default `2` for flashcards, per `FLASHCARDS_LOOP_LIMITS`)
 * without relying solely on `recursionLimit`. The counter is always
 * returned as a finite number so the `keepFiniteNumber` reducer on the
 * state channel preserves the new value.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId`.
 * The `iteration` field on the log carries the `repair_iteration_count`
 * value the node is about to write (post-increment) so operators can
 * correlate log lines with the conditional-edge routing decisions.
 *
 * Flashcards-specific notes:
 *   - Flashcards is repair-only, so this is the sole model-touching node
 *     inside the repair loop. The diagram-quiz pipeline also has a
 *     `refiner` node and a `critic` node, neither of which exist here.
 *   - The repair function is read off `definition.repair.repair`. If a
 *     definition does not configure a repair handler we treat that as a
 *     configuration error rather than silently passing the draft through,
 *     because leaving blocker failures unaddressed would let the run
 *     finalize an invalid flashcards artifact.
 *   - On unrecoverable failure inside the LLM call, we follow the same
 *     "return a failed outcome" pattern as `generate.node.ts`. The
 *     conditional edge after `gate` will then short-circuit to `finalize`
 *     instead of re-entering this node, which would otherwise burn
 *     remaining repair budget on an already-known-bad draft.
 */
export async function repairNode(
  state: typeof FlashcardsStateValue.State
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

    if (!definition.repair) {
      throw new Error('Repair node requires definition.repair');
    }
    const repairedDraft = await definition.repair.repair(
      draft,
      failures,
      (state[ARTIFACT_PIPELINE_STATE_KEYS.context] as Parameters<
        typeof definition.repair.repair
      >[2]),
      (state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as Parameters<
        typeof definition.repair.repair
      >[3])
    );

    const result: RepairNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: repairedDraft,
      repair_iteration_count: nextRepairCount,
    };
    logNodeExitOk(NODE_NAME, state, nextRepairCount);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err, nextRepairCount);
    // P4: propagate the failure as a terminal outcome so the conditional
    // edge after `gate` short-circuits to `finalize` on the next pass.
    // The runner treats `markFailed` as the canonical failure path.
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
        err instanceof Error ? err.message : String(err),
      repair_iteration_count: nextRepairCount,
    };
  }
}

export default repairNode;