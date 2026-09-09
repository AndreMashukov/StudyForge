import { SUMMARY_TRIGGER_MESSAGE_COUNT } from '../../directory-chat-constants';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../../directory-chat-pipeline-state-keys';
import type { DirectoryChatState } from '../state';
import { DirectoryChatStateValue } from '../state';
import { logNodeEnter, logNodeExitError, logNodeExitOk } from './node-logger';

const NODE_NAME = 'maybeSummarize';

export type MaybeSummarizeNodeResult = Partial<DirectoryChatState>;

export async function maybeSummarizeNode(
  state: typeof DirectoryChatStateValue.State
): Promise<MaybeSummarizeNodeResult> {
  logNodeEnter(NODE_NAME, state);
  try {
    const messages = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.messages] ?? [];
    const shouldSummarize = messages.length > SUMMARY_TRIGGER_MESSAGE_COUNT;

    const result = {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]: shouldSummarize,
    } as MaybeSummarizeNodeResult;

    logNodeExitOk(NODE_NAME, state);
    return result;
  } catch (err) {
    logNodeExitError(NODE_NAME, state, err);
    return {
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
      [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.failureMessage]:
        'Failed to evaluate directory chat summarization trigger',
    };
  }
}
