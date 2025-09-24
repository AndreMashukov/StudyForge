import { IQuizStats, IQuizQuestion } from './IQuizTypes';
import { IQuizHandlers, IQuizFormHandlers } from './IQuizHandlers';

export interface IQuizPageHandlers {
  // Quiz data (computed from Redux state)
  currentQuestion: IQuizQuestion | null;
  progress: number;
  stats: IQuizStats;
  isLoading: boolean;
  error: string | null;

  // Quiz handlers
  handleLoadQuiz: IQuizHandlers['handleLoadQuiz'];
  handleAnswerSelect: IQuizHandlers['handleAnswerSelect'];
  handleNextQuestion: IQuizHandlers['handleNextQuestion'];
  handleResetQuiz: IQuizHandlers['handleResetQuiz'];
  handleStartQuiz: IQuizHandlers['handleStartQuiz'];
  handleCompleteQuiz: IQuizHandlers['handleCompleteQuiz'];
  handleSkipQuestion: IQuizHandlers['handleSkipQuestion'];

  // Form handlers
  handleSubmitAnswer: IQuizFormHandlers['handleSubmitAnswer'];
  handleValidateAnswer: IQuizFormHandlers['handleValidateAnswer'];
  clearFormErrors: IQuizFormHandlers['clearFormErrors'];
}

// Main quiz page context interface - clean pattern
export interface IQuizPageContext {
  handlers: IQuizPageHandlers;
}