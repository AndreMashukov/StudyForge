import type { DirectoryChatMessage } from '@shared-types';
import { computeExpiresAt } from '@study-forge/backend-core/lib/firestore-ttl';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../../directory-chat-pipeline-state-keys';
import type { DirectoryChatState } from '../state';
import { DirectoryChatStateValue } from '../state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'respond';

export type RespondNodeResult = Partial<DirectoryChatState>;

export async function respondNode(
  state: typeof DirectoryChatStateValue.State
): Promise<RespondNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const userId = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.userId];
    const directoryId = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryId];
    const assembledPrompt = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assembledPrompt];

    if (!userId || !directoryId || !assembledPrompt) {
      return {
        [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
        [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]:
          'Respond node requires userId, directoryId, and assembledPrompt',
      };
    }

    const answer = await LlmGenerationService.generateDirectoryChatAnswer(
      userId,
      assembledPrompt
    );

    const assistantNow = new Date();
    const assistantMessageRef = FirestorePaths.directoryChatMessages(
      userId,
      directoryId
    ).doc();
    const assistantMessage: DirectoryChatMessage = {
      id: assistantMessageRef.id,
      role: 'assistant',
      content: answer,
      createdAt: assistantNow.toISOString(),
    };

    const result = {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantResponse]: answer,
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.assistantMessage]: assistantMessage,
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages]: [assistantMessage],
    } as RespondNodeResult;

    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    const message =
      err instanceof Error ? err.message : 'Failed to generate directory chat response';
    return {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]: message,
    };
  }
}
