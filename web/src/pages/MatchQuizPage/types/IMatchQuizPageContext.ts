import { MatchQuiz } from '@shared-types';
import { IMatchQuizViewQuestion } from '../../../store/slices/matchQuizPageSlice';
import { IMatchQuizPageHandlers } from './IMatchQuizPageHandlers';

export interface IMatchQuizPageApi {
  firestoreMatchQuiz: MatchQuiz | null;
  questions: IMatchQuizViewQuestion[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
  hasValidId: boolean;
  matchQuizId: string | undefined;
}

export interface IMatchQuizPageContext {
  matchQuizApi: IMatchQuizPageApi;
  handlers: IMatchQuizPageHandlers;
}