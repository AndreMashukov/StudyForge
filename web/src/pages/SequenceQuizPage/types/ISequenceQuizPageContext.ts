import { SequenceQuiz } from '@shared-types';
import { ISequenceQuizQuestion } from './ISequenceQuizTypes';
import { ISequenceQuizPageHandlers } from './ISequenceQuizPageHandlers';

export interface ISequenceQuizPageApi {
  firestoreSequenceQuiz: SequenceQuiz | null;
  questions: ISequenceQuizQuestion[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
  hasValidId: boolean;
  sequenceQuizId: string | undefined;
}

export interface ISequenceQuizPageContext {
  sequenceQuizApi: ISequenceQuizPageApi;
  handlers: ISequenceQuizPageHandlers;
}
