import { buildRollingSummary } from '../build-rolling-summary';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../../directory-chat-pipeline-state-keys';
import type { DirectoryChatState } from '../state';
import { DirectoryChatStateValue } from '../state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'summarize';

export type SummarizeNodeResult = Partial<DirectoryChatState>;

export async function summarizeNode(
  state: typeof DirectoryChatStateValue.State
): Promise<SummarizeNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const messages = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages] ?? [];
    const currentSummary = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.summaryText];
    const summaryText = buildRollingSummary(messages, currentSummary);

    const result = {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.summaryText]: summaryText,
    } as SummarizeNodeResult;

    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    return {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]:
        'Failed to build directory chat conversation summary',
    };
  }
}
