/** LangGraph node: repair flashcard gate failures in the draft. */
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'repair';

export type RepairNodeResult = Partial<FlashcardsState>;

export async function repairNode(
  state: typeof FlashcardsStateValue.State
): Promise<RepairNodeResult> {
  const previousRepairCount = state.repair_loop_count ?? 0;
  const nextRepairCount = previousRepairCount + 1;
  logNodeEnter(NODE_NAME, state, nextRepairCount);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    const failures = state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures];
    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];

    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Repair node requires artifact_definition in state',
        repair_loop_count: nextRepairCount,
      };
    }
    if (draft === undefined) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Repair node requires artifact_draft in state',
        repair_loop_count: nextRepairCount,
      };
    }
    if (!context || !diagnostics) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Repair node requires artifact_context and artifact_diagnostics in state',
        repair_loop_count: nextRepairCount,
      };
    }

    if (!failures?.length) {
      const result: RepairNodeResult = {
        repair_loop_count: nextRepairCount,
      };
      logNodeExitOk(NODE_NAME, state, nextRepairCount);
      return result;
    }

    if (!definition.repair) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Repair node requires definition.repair',
        repair_loop_count: nextRepairCount,
      };
    }

    const repairedDraft = await definition.repair.repair(
      draft,
      failures,
      context,
      diagnostics
    );

    const result: RepairNodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: repairedDraft,
      repair_loop_count: nextRepairCount,
    };
    logNodeExitOk(NODE_NAME, state, nextRepairCount);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err, nextRepairCount);
    const message =
      err instanceof Error ? err.message : 'Flashcard repair failed';
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
      repair_loop_count: nextRepairCount,
    };
  }
}

export default repairNode;
