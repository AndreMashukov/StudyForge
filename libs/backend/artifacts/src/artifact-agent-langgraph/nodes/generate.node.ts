/** LangGraph node: generate the initial artifact draft. */
import {
  LlmGenerationRouteResolver,
  formatGenerationModelLabel,
} from '@study-forge/backend-llm/llm';
import type { IArtifactAgentDiagnostics } from '@shared-types';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../artifact-pipeline-state-keys';
import type { DiagramQuizState } from '../diagram-quiz-state';
import { DiagramQuizStateValue } from '../diagram-quiz-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'generate';

export type GenerateNodeResult = Partial<DiagramQuizState>;

/**
 * LangGraph node: generate the initial artifact draft.
 *
 * This is the ONLY node that writes `artifact_generation_model` and
 * `artifact_agent_model` to the session state. Every other node must leave
 * those keys untouched. Centralizing the model-name write here keeps the
 * contract that the generation and agent model identifiers are captured at
 * the moment the draft is produced, before any repair / refine / critic
 * loop has a chance to overwrite them.
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
 */
export async function generateNode(
  state: typeof DiagramQuizStateValue.State
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
    logNodeExitError(NODE_NAME, state, err);
    throw err;
  }
}

export default generateNode;
