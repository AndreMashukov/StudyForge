import { IUrlScrapingFormData } from '../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';
import { ITextPromptFormData } from '../CreateDocumentPageContainer/TextPromptForm/ITextPromptForm';

export interface ICreateDocumentPageHandlers {
  handleGoBack: () => void;
  handleCreateFromUrl: (data: IUrlScrapingFormData) => Promise<void>;
  handleCreateFromFile: (data: IFileUploadFormData) => Promise<void>;
  handleCreateFromTextPrompt: (data: ITextPromptFormData) => Promise<void>;
  isLoading: boolean;
  isTextPromptLoading: boolean;
  textPromptProgress: number;
  error: string | null;
}

export interface ICreateDocumentPageContext {
  handlers: ICreateDocumentPageHandlers;
}