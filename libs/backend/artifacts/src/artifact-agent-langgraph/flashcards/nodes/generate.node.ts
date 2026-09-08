/** LangGraph node: generate the initial flashcard draft. */
import {
  LlmGenerationRouteResolver,
  formatGenerationModelLabel,
} from '@study-forge/backend-llm/llm';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'generate';

export type GenerateNodeResult = Partial<FlashcardsState>;

export async function generateNode(
  state: typeof FlashcardsStateValue.State
): Promise<GenerateNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    if (!context) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Generate node requires artifact_context in state',
      };
    }

    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Generate node requires artifact_definition in state',
      };
    }

    const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
    if (!diagnostics) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Generate node requires artifact_diagnostics in state',
      };
    }

    const draft = await definition.generate(context, diagnostics);

    const generatorUsage = diagnostics.modelUsage.find(
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
    const message =
      err instanceof Error ? err.message : 'Flashcard generation failed';
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}

export default generateNode;
