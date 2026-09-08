/** LangGraph node: finalize the flashcard artifact and set the terminal outcome. */
import type {
  ArtifactAgentFailure,
  ArtifactAgentResult,
} from '../../../artifact-definition';
import { ARTIFACT_PIPELINE_STATE_KEYS } from '../../../artifact-pipeline-state-keys';
import type { IFlashcardDraft } from '../../../flashcards/flashcard-types';
import type { FlashcardsState } from '../flashcards-state';
import { FlashcardsStateValue } from '../flashcards-state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'finalize';

export type FinalizeNodeResult = Partial<FlashcardsState>;

export async function finalizeNode(
  state: typeof FlashcardsStateValue.State
): Promise<FinalizeNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const definition = state[ARTIFACT_PIPELINE_STATE_KEYS.definition];
    if (!definition) {
      return {
        [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
        [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]:
          'Finalize node requires artifact_definition in state',
      };
    }

    const context = state[ARTIFACT_PIPELINE_STATE_KEYS.context];
    const draft = state[ARTIFACT_PIPELINE_STATE_KEYS.draft];
    const diagnostics = state[ARTIFACT_PIPELINE_STATE_KEYS.diagnostics];
    const outcome = state[ARTIFACT_PIPELINE_STATE_KEYS.outcome];
    const failureMessage = state[ARTIFACT_PIPELINE_STATE_KEYS.failureMessage];
    const generationModel = state[ARTIFACT_PIPELINE_STATE_KEYS.generationModel];
    const agentModel = state[ARTIFACT_PIPELINE_STATE_KEYS.agentModel];

    const gateFailures =
      state[ARTIFACT_PIPELINE_STATE_KEYS.gateFailures] ?? [];
    const hasBlockers = gateFailures.some(
      (failure) => failure.severity === 'blocker'
    );

    const shouldFail =
      outcome === 'failed' ||
      draft === undefined ||
      diagnostics === undefined ||
      hasBlockers;

    const resolvedFailureMessage =
      failureMessage ??
      (hasBlockers
        ? 'Gate blockers remained after the repair loop finished'
        : draft === undefined
          ? 'Artifact draft was not produced'
          : 'Flashcards pipeline failed without a message');

    if (shouldFail) {
      const failure: ArtifactAgentFailure = {
        context: context as ArtifactAgentFailure['context'],
        message: resolvedFailureMessage,
        diagnostics: diagnostics as ArtifactAgentFailure['diagnostics'],
      };
      await definition.markFailed(failure);
    } else {
      const result: ArtifactAgentResult<IFlashcardDraft> = {
        context: context as ArtifactAgentResult<IFlashcardDraft>['context'],
        draft,
        diagnostics: diagnostics as ArtifactAgentResult<IFlashcardDraft>['diagnostics'],
        generationModel: generationModel ?? '',
        agentModel: agentModel ?? '',
      };
      await definition.persistCompleted(result);
    }

    const nodeResult = {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: shouldFail
        ? ('failed' as const)
        : ('completed' as const),
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: shouldFail
        ? resolvedFailureMessage
        : undefined,
    } as FinalizeNodeResult;
    logNodeExitOk(NODE_NAME, state);
    return nodeResult;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Flashcard finalize failed';
    return {
      [ARTIFACT_PIPELINE_STATE_KEYS.outcome]: 'failed',
      [ARTIFACT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}

export default finalizeNode;
