import { IUrlScrapingFormData } from '../CreateDocumentPageContainer/UrlScrapingForm/IUrlScrapingForm';
import { IFileUploadFormData } from '../CreateDocumentPageContainer/FileUploadForm/IFileUploadForm';
import { IPasteTextFormData } from '../CreateDocumentPageContainer/PasteTextForm/IPasteTextForm';
import { ITextPromptFormData } from '../CreateDocumentPageContainer/TextPromptForm/ITextPromptForm';
import { IFileContent } from '@shared-types';

export interface ICreateDocumentPageHandlers {
  handleCreateFromUrl: (data: IUrlScrapingFormData) => void;
  handleCreateFromFile: (data: IFileUploadFormData) => void;
  handleCreateFromPastedText: (data: IPasteTextFormData) => void;
  handleCreateFromTextPrompt: (
    data: ITextPromptFormData,
    fileUploadHelpers?: {
      isContextSizeValid: () => boolean;
      getFilesForSubmission: () => IFileContent[];
    }
  ) => void;
  error: string | null;
}

export interface ICreateDocumentPageContext {
  handlers: ICreateDocumentPageHandlers;
  isReady?: boolean;
}
