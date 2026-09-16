import { IQuizQuestion, IQuizStats, IQuizAnswer, Quiz } from './IQuizTypes';

// Quiz handlers interface for all user actions
export interface IQuizHandlers {
  handleLoadQuiz: (firestoreQuiz: Quiz, questions: IQuizQuestion[]) => void;
  handleAnswerSelect: (answerIndex: number) => void;
  handleNextQuestion: () => void;
  handleResetQuiz: () => void;
  handleStartQuiz: (questions: IQuizQuestion[]) => void;
  handleCompleteQuiz: () => void;
  handleSkipQuestion: () => void;
}

// Quiz form handlers for answer validation
export interface IQuizFormHandlers {
  handleSubmitAnswer: (answerIndex: number, questionId: number) => Promise<{ success: boolean; error?: string }>;
  handleValidateAnswer: (answerIndex: number) => boolean;
  clearFormErrors: () => void;
}

// Quiz effects handlers for side effects
export interface IQuizEffects {
  onQuizStart?: () => void;
  onQuestionChange?: (questionIndex: number) => void;
  onAnswerSubmit?: (answer: IQuizAnswer) => void;
  onQuizComplete?: (stats: IQuizStats) => void;
  onTimeUpdate?: (currentTime: number) => void;
}