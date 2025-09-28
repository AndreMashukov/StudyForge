import { IQuizQuestion } from '../../types/IQuizTypes';

export interface IQuestionCard {
  question: IQuizQuestion;
  selectedAnswer: number | null;
  showExplanation: boolean;
  onAnswerSelect: (answerIndex: number) => void;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
  className?: string;
  onGenerateFollowup?: () => void;
  isGeneratingFollowup?: boolean;
  isFollowupGenerated?: boolean;
}