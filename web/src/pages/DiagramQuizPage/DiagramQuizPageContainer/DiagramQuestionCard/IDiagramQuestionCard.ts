import { IDiagramQuizQuestion } from '../../types/IDiagramQuizTypes';

export interface IDiagramQuestionCard {
  question: IDiagramQuizQuestion;
  currentDiagramIndex: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  onAnswerSelect: (index: number) => void;
  onNextQuestion: () => void;
  onPrevDiagram: () => void;
  onNextDiagram: () => void;
  onDiagramDotClick: (index: number) => void;
  isLastQuestion: boolean;
  className?: string;
  onGenerateFollowup?: () => void;
  isGeneratingFollowup?: boolean;
  isFollowupGenerated?: boolean;
  followupContent?: string;
  /** Progress props for embedded progress bar */
  progress?: number;
  currentQuestion?: number;
  totalQuestions?: number;
  score?: number;
}
