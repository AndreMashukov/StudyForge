import { IUrlScrapingFormData } from '../components/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../components/FileUploadForm/IFileUploadForm';

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