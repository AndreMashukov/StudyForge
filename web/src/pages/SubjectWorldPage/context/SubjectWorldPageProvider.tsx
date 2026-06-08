import React, { ReactNode } from 'react';
import { SubjectWorldPageContext } from './SubjectWorldPageContext';
import { useFetchSubjectWorldData } from './hooks/api/useFetchSubjectWorldData';
import { useSubjectWorldPageHandlers } from './hooks/useSubjectWorldPageHandlers';
import { useSubjectWorldPageEffects } from './hooks/useSubjectWorldPageEffects';
import { ISubjectWorldPageContext } from '../types/ISubjectWorldPageContext';
import { useInteractionTracker } from '../../../hooks/useInteractionTracker';

interface ISubjectWorldPageProviderProps {
  children: ReactNode;
}

export const SubjectWorldPageProvider = ({ children }: ISubjectWorldPageProviderProps) => {
  const fetchApi = useFetchSubjectWorldData();
  const handlers = useSubjectWorldPageHandlers(fetchApi.subjectWorld);
  useSubjectWorldPageEffects(
    fetchApi.subjectWorldId,
    fetchApi.progress,
    fetchApi.subjectWorld?.worldSpec.quests
  );

  useInteractionTracker({
    artifactId: fetchApi.subjectWorld?.id,
    artifactType: 'subjectWorld',
    directoryId: fetchApi.subjectWorld?.directoryId,
  });

  const subjectWorldApi: ISubjectWorldPageContext['subjectWorldApi'] = {
    subjectWorld: fetchApi.subjectWorld,
    isLoading: fetchApi.isLoading,
    isFetching: fetchApi.isFetching,
    error: fetchApi.error as ISubjectWorldPageContext['subjectWorldApi']['error'],
    isError: fetchApi.isError,
    isSuccess: fetchApi.isSuccess,
    refetch: fetchApi.refetch,
    hasValidId: fetchApi.hasValidId,
    subjectWorldId: fetchApi.subjectWorldId,
  };

  const contextValue: ISubjectWorldPageContext = {
    subjectWorldApi,
    handlers,
  };

  return (
    <SubjectWorldPageContext.Provider value={contextValue}>
      {children}
    </SubjectWorldPageContext.Provider>
  );
};
