import React, { useRef, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { DocumentViewerPageContext } from './DocumentViewerPageContext';
import { IDocumentViewerPageContext } from '../types/IDocumentViewerPageContext';
import { useFetchDocumentData } from './hooks/api/useFetchDocumentData';
import { useFetchDocumentContentData } from './hooks/api/useFetchDocumentContentData';
import { useDocumentViewerPageHandlers } from './hooks/useDocumentViewerPageHandlers';
import { useDocumentViewerPageEffects } from './hooks/useDocumentViewerPageEffects';

interface DocumentViewerPageProviderProps {
  children: ReactNode;
}

export const DocumentViewerPageProvider: React.FC<DocumentViewerPageProviderProps> = ({ 
  children 
}) => {
  const { documentId } = useParams<{ documentId: string }>();
  const contentRef = useRef<HTMLDivElement>(null);

  // API hooks - self-contained, access Redux internally
  const documentApi = useFetchDocumentData(documentId);
  const contentApi = useFetchDocumentContentData(documentId);

  // Handler hooks - self-contained business logic
  const handlers = useDocumentViewerPageHandlers({ 
    document: documentApi.data, 
    contentRef 
  });

  // Effect hooks - self-contained side effects, manage their own dependencies
  useDocumentViewerPageEffects();

  const contextValue: IDocumentViewerPageContext = {
    documentApi,    // Complete API object (no destructuring)
    contentApi,     // Complete API object (no destructuring)
    handlers,       // Complete handlers object
    contentRef,
    // DON'T include Redux state - components access directly with useSelector
  };

  return (
    <DocumentViewerPageContext.Provider value={contextValue}>
      {children}
    </DocumentViewerPageContext.Provider>
  );
};