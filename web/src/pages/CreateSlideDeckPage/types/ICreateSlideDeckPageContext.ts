import { UseFormReturn } from 'react-hook-form';
import { IDocumentListResponse } from '../../../store/api/Documents/IDocumentsApi';
import { ICreateSlideDeckFormData } from './ICreateSlideDeckPageTypes';

export interface ICreateSlideDeckPageContext {
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateSlideDeckFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
}
