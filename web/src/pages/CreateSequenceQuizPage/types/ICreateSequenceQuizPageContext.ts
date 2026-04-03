import { UseFormReturn } from 'react-hook-form';
import { IDocumentListResponse } from '../../../store/api/Documents/IDocumentsApi';
import { ICreateSequenceQuizFormData } from './ICreateSequenceQuizPageTypes';

export interface ICreateSequenceQuizPageContext {
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateSequenceQuizFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
}
