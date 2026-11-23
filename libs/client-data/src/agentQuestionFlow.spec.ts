import { describe, expect, it } from 'vitest';
import {
  AGENT_QUESTION_SKIPPED_ANSWER,
  type AgentQuestion,
} from '@shared-types';
import {
  buildAgentQuestionFlowMessage,
  INITIAL_AGENT_QUESTION_FLOW,
  initialAgentQuestionHighlight,
  isAgentQuestionFlowComplete,
  previousAgentQuestionAnswer,
  reduceAgentQuestionFlow,
} from './agentQuestionFlow';

const folderQuestion: AgentQuestion = {
  id: 'folder',
  question: 'Which folder?',
  options: [{ label: 'AWS' }, { label: 'GCP', recommended: true }],
  allowOther: true,
};
const sizeQuestion: AgentQuestion = {
  id: 'size',
  question: 'How many cards?',
  options: [{ label: '10' }, { label: '20' }],
  allowOther: true,
};
const questions: AgentQuestion[] = [folderQuestion, sizeQuestion];

describe('agent question flow', () => {
  it('advances one question at a time and completes after the last', () => {
    let state = INITIAL_AGENT_QUESTION_FLOW;
    state = reduceAgentQuestionFlow(
      state,
      { type: 'answer', answer: 'GCP' },
      2,
    );
    expect(state.index).toBe(1);
    expect(isAgentQuestionFlowComplete(state, 2)).toBe(false);
    state = reduceAgentQuestionFlow(
      state,
      { type: 'answer', answer: ' 25 ' },
      2,
    );
    expect(isAgentQuestionFlowComplete(state, 2)).toBe(true);
    expect(buildAgentQuestionFlowMessage(questions, state)).toBe(
      'Which folder?\n→ GCP\n\nHow many cards?\n→ 25',
    );
  });

  it('records skipped questions as no preference', () => {
    let state = reduceAgentQuestionFlow(
      INITIAL_AGENT_QUESTION_FLOW,
      { type: 'skip' },
      2,
    );
    state = reduceAgentQuestionFlow(state, { type: 'answer', answer: '10' }, 2);
    expect(buildAgentQuestionFlowMessage(questions, state)).toContain(
      `→ ${AGENT_QUESTION_SKIPPED_ANSWER}`,
    );
  });

  it('goes back and lets the user change an earlier answer', () => {
    let state = reduceAgentQuestionFlow(
      INITIAL_AGENT_QUESTION_FLOW,
      { type: 'answer', answer: 'AWS' },
      2,
    );
    state = reduceAgentQuestionFlow(state, { type: 'back' }, 2);
    expect(state.index).toBe(0);
    expect(previousAgentQuestionAnswer(state)).toBe('AWS');
    state = reduceAgentQuestionFlow(
      state,
      { type: 'answer', answer: 'GCP' },
      2,
    );
    expect(state.answers).toEqual(['GCP']);
    expect(
      reduceAgentQuestionFlow(INITIAL_AGENT_QUESTION_FLOW, { type: 'back' }, 2)
        .index,
    ).toBe(0);
  });

  it('ignores answers once complete', () => {
    const done = { index: 2, answers: ['AWS', '10'] };
    expect(
      reduceAgentQuestionFlow(done, { type: 'answer', answer: 'x' }, 2),
    ).toBe(done);
  });

  it('highlights the recommended option first', () => {
    expect(initialAgentQuestionHighlight(folderQuestion)).toBe(1);
    expect(initialAgentQuestionHighlight(sizeQuestion)).toBe(0);
  });
});
