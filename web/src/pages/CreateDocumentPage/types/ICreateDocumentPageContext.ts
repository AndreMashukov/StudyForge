import { IUrlScrapingFormData } from '../components/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../components/FileUploadForm/IFileUploadForm';

export interface ICreateDocumentPageHandlers {
  handleGoBack: () => void;
  handleCreateFromUrl: (data: IUrlScrapingFormData) => void;
  handleCreateFromFile: (data: IFileUploadFormData) => void;
}

export interface ICreateDocumentPageContext {
  isLoading: boolean;
  error: string | null;
  handlers: ICreateDocumentPageHandlers;
}