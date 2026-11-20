import type { ReactNode } from 'react';
import { IDiagramQuizQuestion } from '../../types/IDiagramQuizTypes';

export interface IDiagramQuestionCard {
  question: IDiagramQuizQuestion;
  currentDiagramIndex: number;
  selectedAnswer: number | null;
  showFeedback: boolean;
  onAnswerSelect: (index: number) => void;
  onNextQuestion: () => void;
  onPrevDiagram: () => void;
  onNextDiagram: () => void;
  onDiagramDotClick: (index: number) => void;
  isLastQuestion: boolean;
  className?: string;
  backAction?: ReactNode;
}
