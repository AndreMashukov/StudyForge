import { END } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { DIRECTORY_CHAT_PIPELINE_STATE_KEYS } from '../directory-chat-pipeline-state-keys';
import {
  DIRECTORY_CHAT_NODE_NAMES,
  routeAfterMaybeSummarize,
  routeAfterSummarize,
} from './routes';
import type { DirectoryChatState } from './state';

function routeState(
  fixture: Partial<DirectoryChatState>
): DirectoryChatState {
  return fixture as DirectoryChatState;
}

describe('routeAfterMaybeSummarize', () => {
  it('routes to END when the run is already failed', () => {
    expect(
      routeAfterMaybeSummarize(
        routeState({
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
        })
      )
    ).toBe(END);
  });

  it('routes to summarize when shouldSummarize is true', () => {
    expect(
      routeAfterMaybeSummarize(
        routeState({
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]: true,
        })
      )
    ).toBe(DIRECTORY_CHAT_NODE_NAMES.summarize);
  });

  it('routes to persist when shouldSummarize is false', () => {
    expect(
      routeAfterMaybeSummarize(
        routeState({
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.shouldSummarize]: false,
        })
      )
    ).toBe(DIRECTORY_CHAT_NODE_NAMES.persist);
  });
});

describe('routeAfterSummarize', () => {
  it('routes to END when the run is already failed', () => {
    expect(
      routeAfterSummarize(
        routeState({
          [DIRECTORY_CHAT_PIPELINE_STATE_KEYS.directoryChatOutcome]: 'failed',
        })
      )
    ).toBe(END);
  });

  it('routes to persist when summarization succeeded', () => {
    expect(routeAfterSummarize(routeState({}))).toBe(
      DIRECTORY_CHAT_NODE_NAMES.persist
    );
  });
});
