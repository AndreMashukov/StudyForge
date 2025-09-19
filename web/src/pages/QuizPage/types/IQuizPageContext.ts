import { IQuizStats, IQuizQuestion } from './IQuizTypes';
import { IQuizHandlers, IQuizFormHandlers } from './IQuizHandlers';

// Main quiz page context interface - Redux state accessed via useSelector
export interface IQuizPageContext {
  // Quiz data (computed from Redux state)
  currentQuestion: IQuizQuestion | null;
  progress: number;
  stats: IQuizStats;
  
  // Handlers
  handlers: IQuizHandlers;
  formHandlers: IQuizFormHandlers;
  
  // Loading states (from Redux)
  isLoading: boolean;
  error: string | null;
}