import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  selectSelectedSource,
  selectAttachedFiles,
  selectContextSizeError,
  selectCanAttachMore,
  selectSelectedDocumentIds,
  selectUrlFormLoading,
  selectFileFormLoading,
  selectTextPromptFormLoading,
  selectTextPromptFormProgress,
  selectDirectoryId,
} from '../../../../store/slices/createDocumentPageSlice';
import { useGetUserDocumentsQuery } from '../../../../store/api/Documents';
import { useCreateDocumentPageContext } from '../../context/hooks/useCreateDocumentPageContext';
import { UrlScrapingForm } from '../UrlScrapingForm';
import { FileUploadForm } from '../FileUploadForm';
import { TextPromptForm } from '../TextPromptForm';
import { Globe, Upload, Sparkles } from 'lucide-react';
import { ITextPromptFormData } from '../TextPromptForm/ITextPromptForm';
import type { RootState } from '../../../../store';
import { useFileUpload } from '../../context/hooks/useFileUpload';


const getFormIcon = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return <Globe size={18} />;
    case 'file':
      return <Upload size={18} />;
    case 'textPrompt':
      return <Sparkles size={18} />;
    default:
      return null;
  }
};

const getFormTitle = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return 'Website Content Scraper';
    case 'file':
      return 'File Upload';
    case 'textPrompt':
      return 'AI Document Generator';
    default:
      return 'Create Document';
  }
};

const getFormDescription = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return 'Enter a URL to scrape and convert to a document';
    case 'file':
      return 'Upload a markdown file to create a document';
    case 'textPrompt':
      return 'Describe what you want to learn — AI will generate the document';
    default:
      return '';
  }
};

export const FormRenderer = () => {
  const { handlers } = useCreateDocumentPageContext();
  
  // Redux selectors for state
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  const isUrlLoading = useSelector((state: RootState) => selectUrlFormLoading(state));
  const isFileLoading = useSelector((state: RootState) => selectFileFormLoading(state));
  const isTextPromptLoading = useSelector((state: RootState) => selectTextPromptFormLoading(state));
  const textPromptProgress = useSelector((state: RootState) => selectTextPromptFormProgress(state));
  const attachedFiles = useSelector((state: RootState) => selectAttachedFiles(state));
  const contextSizeError = useSelector((state: RootState) => selectContextSizeError(state));
  const canAttachMore = useSelector((state: RootState) => selectCanAttachMore(state));
  const selectedDocumentIds = useSelector((state: RootState) => selectSelectedDocumentIds(state));
  
  // Fetch user documents for library selector
  const { data: documentsData, isLoading: isLoadingDocuments } = useGetUserDocumentsQuery();
  const directoryId = useSelector((state: RootState) => selectDirectoryId(state));
  const userDocuments = useMemo(() => {
    const allDocuments = documentsData?.documents ?? [];
    return directoryId
      ? allDocuments.filter((d) => d.directoryId === directoryId)
      : allDocuments;
  }, [documentsData?.documents, directoryId]);
  
  // File upload hook with documents
  const fileUpload = useFileUpload(userDocuments);

  // Handle text prompt submission with file upload helpers
  const handleTextPromptSubmit = async (data: ITextPromptFormData) => {
    await handlers.handleCreateFromTextPrompt(data, {
      isContextSizeValid: fileUpload.isContextSizeValid,
      getFilesForSubmission: fileUpload.getFilesForSubmission,
    });
  };

  if (!selectedSource) {
    return null;
  }

  return (
    <div className="space-y-0">
      {/* Form header */}
      <div className="flex items-center gap-2 pb-4 mb-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
          {getFormIcon(selectedSource)}
        </div>
        <div>
          <h2 className="text-base font-semibold">
            {getFormTitle(selectedSource)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {getFormDescription(selectedSource)}
          </p>
        </div>
      </div>
      
      {/* Form content */}
      {selectedSource === 'website' && (
        <UrlScrapingForm
          isLoading={isUrlLoading}
          onSubmit={handlers.handleCreateFromUrl}
        />
      )}
      
      {selectedSource === 'file' && (
        <FileUploadForm
          isLoading={isFileLoading}
          onSubmit={handlers.handleCreateFromFile}
        />
      )}
      
      {selectedSource === 'textPrompt' && (
        <TextPromptForm
          isLoading={isTextPromptLoading}
          progress={textPromptProgress}
          onSubmit={handleTextPromptSubmit}
          attachedFiles={attachedFiles}
          onFilesSelected={fileUpload.handleFileAdd}
          onFileRemove={fileUpload.handleFileRemove}
          canAttachMore={canAttachMore}
          totalTokens={fileUpload.getTotalTokens()}
          contextSizeError={contextSizeError}
          userDocuments={userDocuments}
          selectedDocumentIds={selectedDocumentIds}
          onDocumentToggle={fileUpload.handleDocumentToggle}
          isLoadingDocuments={isLoadingDocuments}
        />
      )}
      
      {selectedSource === 'videoUrl' && (
        <div className="text-center py-12">
          <span role="img" aria-label="Under construction" className="text-4xl mb-4 block">
            🚧
          </span>
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground">
            This feature is currently under development and will be available soon.
          </p>
        </div>
      )}
    </div>
  );
};
