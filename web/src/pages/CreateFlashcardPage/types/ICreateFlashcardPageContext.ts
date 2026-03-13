import { UseFormReturn } from 'react-hook-form';
import { IDocumentListResponse } from '../../../store/api/Documents/IDocumentsApi';
import { ICreateFlashcardFormData } from './ICreateFlashcardPageTypes';

export interface ICreateFlashcardPageContext {
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateFlashcardFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
}
