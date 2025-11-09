import React from 'react';
import { useSelector } from 'react-redux';
import { 
  selectSelectedSource,
  selectAttachedFiles,
  selectContextSizeError,
  selectCanAttachMore,
  selectSelectedDocumentIds,
} from '../../../../store/slices/createDocumentPageSlice';
import { useGetUserDocumentsQuery } from '../../../../store/api/Documents';
import { UrlScrapingForm } from '../UrlScrapingForm';
import { FileUploadForm } from '../FileUploadForm';
import { TextPromptForm } from '../TextPromptForm';
import { FormContainer } from '../FormContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Globe, Upload, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { IUrlScrapingFormData } from '../UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../FileUploadForm/IFileUploadForm';
import { ITextPromptFormData } from '../TextPromptForm/ITextPromptForm';
import { IFileContent } from '@shared-types';
import type { RootState } from '../../../../store';
import { useFileUpload } from '../../context/hooks/useFileUpload';

interface IFormRendererProps {
  onSubmitUrl: (data: IUrlScrapingFormData) => Promise<void>;
  onSubmitFile: (data: IFileUploadFormData) => Promise<void>;
  onSubmitTextPrompt: (
    data: ITextPromptFormData,
    fileUploadHelpers: {
      isContextSizeValid: () => boolean;
      getFilesForSubmission: () => IFileContent[];
    }
  ) => Promise<void>;
  isUrlLoading: boolean;
  isFileLoading: boolean;
  isTextPromptLoading: boolean;
  textPromptProgress?: number;
  onBack?: () => void;
  directoryId: string | null;
  selectedRuleIds: string[];
  onRuleIdsChange: (ruleIds: string[]) => void;
}

const getFormIcon = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return <Globe size={20} />;
    case 'file':
      return <Upload size={20} />;
    case 'textPrompt':
      return <Sparkles size={20} />;
    default:
      return null;
  }
};

const getFormTitle = (sourceType: string) => {
  switch (sourceType) {
    case 'website':
      return 'Website Content Scraper';
    case 'file':
      return 'File Upload Center';
    case 'textPrompt':
      return 'AI Document Generator';
    default:
      return 'Create Document';
  }
};

export const FormRenderer = ({
  onSubmitUrl,
  onSubmitFile,
  onSubmitTextPrompt,
  isUrlLoading,
  isFileLoading,
  isTextPromptLoading,
  textPromptProgress,
  onBack,
  directoryId,
  selectedRuleIds,
  onRuleIdsChange,
}: IFormRendererProps) => {
  const selectedSource = useSelector((state: RootState) => selectSelectedSource(state));
  
  // Fetch user documents for library selector
  const { data: documentsData, isLoading: isLoadingDocuments } = useGetUserDocumentsQuery();
  const userDocuments = documentsData?.documents || [];
  
  // File upload hook with documents
  const fileUpload = useFileUpload(userDocuments);
  
  // Redux selectors
  const attachedFiles = useSelector((state: RootState) => selectAttachedFiles(state));
  const contextSizeError = useSelector((state: RootState) => selectContextSizeError(state));
  const canAttachMore = useSelector((state: RootState) => selectCanAttachMore(state));
  const selectedDocumentIds = useSelector((state: RootState) => selectSelectedDocumentIds(state));

  // Handle text prompt submission with file upload helpers
  const handleTextPromptSubmit = async (data: ITextPromptFormData) => {
    await onSubmitTextPrompt(data, {
      isContextSizeValid: fileUpload.isContextSizeValid,
      getFilesForSubmission: fileUpload.getFilesForSubmission,
    });
  };

  if (!selectedSource) {
    return null;
  }

  return (
    <FormContainer>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="hover:bg-muted"
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            <div className="flex items-center gap-2">
              {getFormIcon(selectedSource)}
              <CardTitle className="text-lg">
                {getFormTitle(selectedSource)}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {selectedSource === 'website' && (
            <UrlScrapingForm
              isLoading={isUrlLoading}
              onSubmit={onSubmitUrl}
            />
          )}
          
          {selectedSource === 'file' && (
            <FileUploadForm
              isLoading={isFileLoading}
              onSubmit={onSubmitFile}
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
              directoryId={directoryId}
              selectedRuleIds={selectedRuleIds}
              onRuleIdsChange={onRuleIdsChange}
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
        </CardContent>
      </Card>
    </FormContainer>
  );
};