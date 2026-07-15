import React from 'react';
import { useSelector } from 'react-redux';
import {
  selectSelectedSource,
} from '../../../../store/slices/createDocumentPageSlice';
import { useCreateDocumentPageContext } from '../../context/hooks/useCreateDocumentPageContext';
import { UrlScrapingForm } from '../UrlScrapingForm';
import { FileUploadForm } from '../FileUploadForm';
import { TextPromptForm } from '../TextPromptForm';
import { Globe, Upload, Sparkles } from 'lucide-react';
import { ITextPromptFormData } from '../TextPromptForm/ITextPromptForm';
import type { RootState } from '../../../../store';


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
      return 'URL Document Generator';
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
      return 'Turn web pages or YouTube videos into a document';
    case 'file':
      return 'Upload a document to create a study guide';
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

  // Handle text prompt submission
  const handleTextPromptSubmit = async (data: ITextPromptFormData) => {
    await handlers.handleCreateFromTextPrompt(data);
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
          onSubmit={handlers.handleCreateFromUrl}
        />
      )}
      
      {selectedSource === 'file' && (
        <FileUploadForm
          onSubmit={handlers.handleCreateFromFile}
        />
      )}
      
      {selectedSource === 'textPrompt' && (
        <TextPromptForm
          onSubmit={handleTextPromptSubmit}
        />
      )}
    </div>
  );
};
