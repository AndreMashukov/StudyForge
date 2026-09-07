/** LangGraph node: generate the initial flashcards draft. */
import {
  LlmGenerationRouteResolver,
  formatGenerationModelLabel,
} from '@study-forge/backend-llm/llm';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../../artifact-pipeline-state-keys';
import { FlashcardsStateValue } from '../flashcards-state';
import type { FlashcardsState } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'generate';

export type GenerateNodeResult = Partial<FlashcardsState>;

/**
 * LangGraph node: generate the initial flashcards draft.
 *
 * This is the ONLY node that writes `artifact_generation_model` and
 * `artifact_agent_model` to the session state. Every other node must leave
 * those keys untouched. Centralizing the model-name write here keeps the
 * contract that the generation and agent model identifiers are captured at
 * the moment the draft is produced, before any repair loop has a chance to
 * overwrite them.
 *
 * The model label is taken from the `generator` entry in
 * `diagnostics.modelUsage` that `definition.generate` recorded. That
 * entry reflects the model that actually produced the draft, including
 * any provider/model fallback. Only if no `generator` usage was recorded
 * do we fall back to the primary route label from
 * `LlmGenerationRouteResolver`. This keeps the LangGraph pipeline's
 * model fields in lock-step with the audit and prevents labeling the
 * record with the primary route when the live call actually used a
 * fallback.
 *
 * Emits `node_enter` and `node_exit` structured log lines with `jobId` so
 * generation latency and LLM errors can be tied back to the triggering
 * artifact job in Cloud Logging.
 *
 * Flashcards-specific notes:
 *   - Flashcards is repair-only (no critic, no refiner) so this node is
 *     the sole LLM entry into the graph. The repair node also touches an
 *     LLM via `definition.repair.repair`, but that is conditioned on the
 *     gate returning blocker failures. After repair the conditional edge
 *     re-enters `gate`, which is deterministic.
 *   - Failure here sets `artifact_outcome = 'failed'` rather than
 *     re-throwing so the conditional edge from `gate` can short-circuit
 *     straight to `finalize`. Per P4 of the migration spec, the gate
 *     edge checks `artifact_outcome` before doing any work, so a failed
 *     generation never re-enters the repair loop with an empty draft.
 *     Without this, the gate node would throw on the undefined draft and
 *     the failure message would be lost.
 */
export async function generateNode(
  state: typeof FlashcardsStateValue.State
): Promise<GenerateNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    if (!context) {
      throw new Error('Generate node requires artifact_context in state');
    }

    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      throw new Error('Generate node requires artifact_definition in state');
    }

    const draft = await definition.generate(
      context,
      state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as Parameters<
        typeof definition.generate
      >[1]
    );

    // Prefer the model the LLM call actually used (recorded in
    // `diagnostics.modelUsage` by `definition.generate`). Fall back to the
    // primary route label only when no generator usage was recorded.
    const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics] as
      | IArtifactAgentDiagnostics
      | undefined;
    const generatorUsage = diagnostics?.modelUsage.find(
      (entry) => entry.role === 'generator'
    );
    const modelLabel =
      generatorUsage?.model ??
      formatGenerationModelLabel(
        (
          await LlmGenerationRouteResolver.resolve(definition.artifactKind, {
            userId: context.userId,
          })
        ).route
      );

    const result = {
      [ARTIFACT_PIPELINE_STATE_KEYS.draft]: draft,
      [ARTIFACT_PIPELINE_STATE_KEYS.generationModel]: modelLabel,
      [ARTIFACT_PIPELINE_STATE_KEYS.agentModel]: modelLabel,
    } as GenerateNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    // P4: per the migration spec, nodes must NOT throw on a generation
    // failure - they must set `artifact_outcome = 'failed'` and let the
    // conditional edge route straight to `finalize`. Throwing here would
    // also exit the graph, but it would bypass the `markFailed` callback
    // that `finalize` invokes, which would leave the Firestore record
    // without a recorded failure. We therefore return a partial state
    // update that flips the outcome channel and carries the error message
    // for the runner to display.
    logNodeExitError(NODE_NAME, state, err);
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
        err instanceof Error ? err.message : String(err),
    };
  }
}

export default generateNode;