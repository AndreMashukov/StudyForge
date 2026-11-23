import type { AgentQuestion } from '@shared-types';
import { formatAgentQuestionAnswers } from '@shared-types';

/**
 * Step-by-step answering of the agent's clarifying questions, shared by web
 * and mobile. One question is shown at a time; after the last one the answers
 * go out together as a single user message.
 */
export interface IAgentQuestionFlowState {
  /** Index of the question on screen; equals the question count when done. */
  index: number;
  /** One entry per answered question: text, or null when skipped. */
  answers: Array<string | null>;
}

export type AgentQuestionFlowAction =
  | { type: 'answer'; answer: string }
  | { type: 'skip' }
  | { type: 'back' };

export const INITIAL_AGENT_QUESTION_FLOW: IAgentQuestionFlowState = {
  index: 0,
  answers: [],
};

export function reduceAgentQuestionFlow(
  state: IAgentQuestionFlowState,
  action: AgentQuestionFlowAction,
  questionCount: number,
): IAgentQuestionFlowState {
  if (action.type === 'back') {
    return { ...state, index: Math.max(0, state.index - 1) };
  }
  if (state.index >= questionCount) {
    return state;
  }
  const answers = state.answers.slice(0, state.index);
  answers[state.index] =
    action.type === 'skip' ? null : action.answer.trim() || null;
  return { index: state.index + 1, answers };
}

export function isAgentQuestionFlowComplete(
  state: IAgentQuestionFlowState,
  questionCount: number,
): boolean {
  return questionCount > 0 && state.index >= questionCount;
}

/** The message that sends every answer, in question order. */
export function buildAgentQuestionFlowMessage(
  questions: ReadonlyArray<AgentQuestion>,
  state: IAgentQuestionFlowState,
): string {
  return formatAgentQuestionAnswers(
    questions.map((question, index) => ({
      question,
      answer: state.answers[index] ?? null,
    })),
  );
}

/** Option highlighted when a question appears: the recommended one, else the first. */
export function initialAgentQuestionHighlight(question: AgentQuestion): number {
  const recommended = question.options.findIndex(
    (option) => option.recommended,
  );
  return recommended >= 0 ? recommended : 0;
}

/** The answer previously given for a question, so Back can show it selected. */
export function previousAgentQuestionAnswer(
  state: IAgentQuestionFlowState,
): string | null | undefined {
  return state.answers[state.index];
}
