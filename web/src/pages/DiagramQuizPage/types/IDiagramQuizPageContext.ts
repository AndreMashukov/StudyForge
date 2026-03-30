import { DiagramQuiz } from '@shared-types';
import { IDiagramQuizQuestion } from './IDiagramQuizTypes';
import { IDiagramQuizPageHandlers } from './IDiagramQuizPageHandlers';

export interface IDiagramQuizPageApi {
  firestoreDiagramQuiz: DiagramQuiz | null;
  questions: IDiagramQuizQuestion[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => void;
  hasValidId: boolean;
  diagramQuizId: string | undefined;
}

export interface IDiagramQuizPageContext {
  diagramQuizApi: IDiagramQuizPageApi;
  handlers: IDiagramQuizPageHandlers;
}
