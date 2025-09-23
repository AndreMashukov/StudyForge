import { Quiz, QuizQuestion } from '@shared-types';

// Re-export types from shared-types for consistency
export type { Quiz, QuizQuestion } from '@shared-types';

// Quiz question data structure (extending shared type for UI management)
export interface IQuizQuestion extends QuizQuestion {
  id: number; // Add numeric ID for UI state management
  correct: number; // Add correct property for UI consistency (maps to correctAnswer)
  // explanation is now mandatory from shared types
}

// User's answer to a question
export interface IQuizAnswer {
  questionId: number;
  selected: number;
  correct: number;
  isCorrect: boolean;
  timeSpent?: number;
}

// Quiz session state (for Redux)
export interface IQuizState {
  // API data
  firestoreQuiz: Quiz | null;
  questions: IQuizQuestion[];
  
  // Quiz session state
  currentQuestionIndex: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  score: number;
  answers: IQuizAnswer[];
  isCompleted: boolean;
  startTime: number | null;
  endTime: number | null;
  totalTimeSpent: number;
}

// Quiz statistics for results
export interface IQuizStats {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number;
  answersBreakdown: IQuizAnswer[];
}

// Quiz action types for state updates
export type QuizAction =
  | { type: 'LOAD_QUIZ'; payload: { quiz: Quiz } }
  | { type: 'START_QUIZ'; payload: { questions: IQuizQuestion[] } }
  | { type: 'SELECT_ANSWER'; payload: { answerIndex: number } }
  | { type: 'SHOW_EXPLANATION' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'COMPLETE_QUIZ' }
  | { type: 'RESET_QUIZ' }
  | { type: 'UPDATE_TIME'; payload: { time: number } };

// Quiz form data for validation
export interface IQuizFormData {
  selectedAnswer: number;
  questionId: number;
}