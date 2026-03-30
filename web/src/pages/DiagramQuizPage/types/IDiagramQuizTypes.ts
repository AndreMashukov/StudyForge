import { DiagramQuizQuestion } from '@shared-types';

export interface IDiagramQuizQuestion extends DiagramQuizQuestion {
  id: number;
  correct: number;
}

export interface IDiagramQuizAnswer {
  questionId: number;
  selected: number;
  correct: number;
  isCorrect: boolean;
  timeSpent?: number;
}
