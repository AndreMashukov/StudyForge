import { IUrlScrapingFormData } from '../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';

export interface ICreateDocumentPageHandlers {
  handleGoBack: () => void;
  handleCreateFromUrl: (data: IUrlScrapingFormData) => Promise<void>;
  handleCreateFromFile: (data: IFileUploadFormData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export interface ICreateDocumentPageContext {
  handlers: ICreateDocumentPageHandlers;
}