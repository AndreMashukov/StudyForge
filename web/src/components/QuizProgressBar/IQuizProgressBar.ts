import type { ReactNode } from 'react';

export interface IQuizProgressBar {
  progress: number;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  answeredCount: number;
  /** Optional control rendered before "Question X of Y" (e.g. back link). */
  leadingAction?: ReactNode;
}
