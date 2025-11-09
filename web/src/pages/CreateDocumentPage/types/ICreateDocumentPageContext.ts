import { IUrlScrapingFormData } from '../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';
import { ITextPromptFormData } from '../CreateDocumentPageContainer/TextPromptForm/ITextPromptForm';
import { IFileContent } from '@shared-types';

export interface ICreateDocumentPageHandlers {
  handleGoBack: () => void;
  handleCreateFromUrl: (data: IUrlScrapingFormData) => Promise<void>;
  handleCreateFromFile: (data: IFileUploadFormData) => Promise<void>;
  handleCreateFromTextPrompt: (
    data: ITextPromptFormData,
    fileUploadHelpers: {
      isContextSizeValid: () => boolean;
      getFilesForSubmission: () => IFileContent[];
    }
  ) => Promise<void>;
  handleRuleIdsChange: (ruleIds: string[]) => void;
  isLoading: boolean;
  isTextPromptLoading: boolean;
  textPromptProgress: number;
  error: string | null;
}

export interface ICreateDocumentPageContext {
  handlers: ICreateDocumentPageHandlers;
  directoryId: string | null;
  selectedRuleIds: string[];
}