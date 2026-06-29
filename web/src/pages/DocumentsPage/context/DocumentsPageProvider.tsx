import React, { useEffect } from 'react';
import { DocumentsPageContext } from './DocumentsPageContext';
import { IDocumentsPageContext } from '../types/IDocumentsPageContext';
import { useDocumentsPageHandlers } from './hooks/useDocumentsPageHandlers';
import { useDocumentsPageEffects } from './hooks/useDocumentsPageEffects';
import { useRealtimeDirectorySync } from './hooks/useRealtimeDirectorySync';
import { useDirectoryDocumentsRealtimeCache } from '../../DirectoryDetailPage/hooks/useDirectoryDocumentsRealtimeCache';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { selectSelectedDirectoryId } from '../../../store/slices/directorySlice';
import { prefetchDirectoryContents } from '../utils/prefetchDirectoryContents';

interface DocumentsPageProviderProps {
  children: React.ReactNode;
}

export const DocumentsPageProvider: React.FC<DocumentsPageProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const selectedDirectoryId = useAppSelector(selectSelectedDirectoryId);
  const handlers = useDocumentsPageHandlers();

  useDocumentsPageEffects({ handlers });

  useRealtimeDirectorySync(undefined, { subdirectoriesOnly: true });
  useDirectoryDocumentsRealtimeCache(selectedDirectoryId, {
    patchArtifactSummaries: false,
    patchDirectoryContents: true,
  });

  useEffect(() => {
    prefetchDirectoryContents(dispatch, null);
  }, [dispatch]);

  const contextValue: IDocumentsPageContext = {
    handlers,
  };

  return (
    <DocumentsPageContext.Provider value={contextValue}>
      {children}
    </DocumentsPageContext.Provider>
  );
};
