import { END } from '@langchain/langgraph';
import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import type { DirectoryChatState } from './state';

export const DIRECTORY_CHAT_NODE_NAMES = {
  respond: 'respond',
  maybeSummarize: 'maybeSummarize',
  summarize: 'summarize',
  persist: 'persist',
} as const;

export type RouteAfterMaybeSummarizeTarget =
  | typeof DIRECTORY_CHAT_NODE_NAMES.summarize
  | typeof DIRECTORY_CHAT_NODE_NAMES.persist
  | typeof END;

function readOutcome(state: DirectoryChatState): string | undefined {
  const value = state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome];
  return typeof value === 'string' ? value : undefined;
}

function readShouldSummarize(state: DirectoryChatState): boolean {
  return state[DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize] === true;
}

export function routeAfterMaybeSummarize(
  state: DirectoryChatState
): RouteAfterMaybeSummarizeTarget {
  if (readOutcome(state) === 'failed') {
    return END;
  }

  return readShouldSummarize(state)
    ? DIRECTORY_CHAT_NODE_NAMES.summarize
    : DIRECTORY_CHAT_NODE_NAMES.persist;
}
