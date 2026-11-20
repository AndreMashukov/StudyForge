import type { ReactNode } from 'react';
import { IQuizQuestion } from '../../types/IQuizTypes';

export interface IQuestionCard {
  question: IQuizQuestion;
  selectedAnswer: number | null;
  showFeedback: boolean;
  onAnswerSelect: (answerIndex: number) => void;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
  className?: string;
  backAction?: ReactNode;
}
