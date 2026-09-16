import type { ReactNode } from 'react';
import { IQuizQuestion } from '../../types/IQuizTypes';

export interface IQuestionCard {
  question: IQuizQuestion;
  selectedAnswer: number | null;
  showExplanation: boolean;
  onAnswerSelect: (answerIndex: number) => void;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
  className?: string;
  backAction?: ReactNode;
  onGenerateFollowup?: () => void;
  isGeneratingFollowup?: boolean;
  isFollowupGenerated?: boolean;
}
