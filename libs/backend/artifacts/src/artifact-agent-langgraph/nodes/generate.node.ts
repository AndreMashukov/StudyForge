/** LangGraph node: generate the initial artifact draft. */
import {
  LlmGenerationRouteResolver,
  formatGenerationModelLabel,
} from '@study-forge/backend-llm/llm';
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
 * The model identifiers are resolved via the same route resolver that the
 * ADK `diagram-quiz-definition.generate` uses internally (and that
 * `persistCompleted` later reads back out of the audit). This keeps the
 * LangGraph pipeline's model fields in lock-step with the ADK audit values.
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

    // Resolve the same route the ADK definition records into diagnostics so
    // `artifact_generation_model` and `artifact_agent_model` stay in sync
    // with the actual model the LLM call used. Both fields use the same
    // label: the ADK factory populates them from the audit, and the audit
    // is keyed off the resolved route. Writing both here means downstream
    // persistence can read either field without needing to consult
    // diagnostics.
    const routeResolution = await LlmGenerationRouteResolver.resolve(
      definition.artifactKind,
      { userId: context.userId }
    );
    const modelLabel = formatGenerationModelLabel(routeResolution.route);

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
