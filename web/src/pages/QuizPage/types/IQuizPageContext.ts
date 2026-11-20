import { Quiz } from '@shared-types';
import { IQuizHandlers, IQuizFormHandlers } from './IQuizHandlers';
import { IQuizQuestion } from './IQuizTypes';

export interface IQuizPageHandlers {
  // Quiz handlers (business logic only, no state)
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

export interface IQuizApi {
  // Original quiz data from Firestore
  firestoreQuiz: Quiz | null;
  
  // Transformed data for UI
  questions: IQuizQuestion[];
  
  // Query state
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
  
  // Actions
  refetch: () => void;
  
  // Validation
  hasValidQuizId: boolean;
  quizId: string | undefined;
}

// Main quiz page context interface - clean pattern
export interface IQuizPageContext {
  quizApi: IQuizApi;    // Complete API object (no destructuring)
  handlers: IQuizPageHandlers; // Complete handlers object
  // DON'T include Redux state - components access directly with useSelector
}