import type { ReactNode } from 'react';

export interface IQuizQuestionHeader {
  progress: number;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  answeredCount: number;
  questionText: string;
  hint?: string | null;
  /** Optional control rendered before "Question X of Y" (e.g. back link). */
  leadingAction?: ReactNode;
}
