import { SubjectWorld } from '@shared-types';
import { SerializedError } from '@reduxjs/toolkit';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ISubjectWorldPageHandlers } from './ISubjectWorldPageHandlers';

export interface ISubjectWorldPageContext {
  subjectWorldApi: {
    subjectWorld: SubjectWorld | null | undefined;
    isLoading: boolean;
    isFetching: boolean;
    error: FetchBaseQueryError | SerializedError | undefined;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => void;
    hasValidId: boolean;
    subjectWorldId: string | undefined;
  };
  handlers: ISubjectWorldPageHandlers;
}
