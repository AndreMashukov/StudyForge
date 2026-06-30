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

  // Only run the documents page listeners when actually on the documents page
  // to avoid duplicating the listeners from DirectoryRealtimeBridge
  const isDocumentsPage = window.location.pathname === '/documents';

  useRealtimeDirectorySync(isDocumentsPage ? undefined : null, { subdirectoriesOnly: true });
  useDirectoryDocumentsRealtimeCache(isDocumentsPage ? selectedDirectoryId : null, {
    patchArtifactSummaries: false,
    patchDirectoryContents: isDocumentsPage,
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
