import { UseFormReturn } from 'react-hook-form';
import { IDocumentListResponse } from '../../../store/api/Documents/IDocumentsApi';
import { ICreateQuizFormData } from './ICreateQuizPageTypes';

export interface ICreateQuizPageContext {
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateQuizFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
  // DON'T include: formData (managed by React Hook Form)
  // DON'T include: documents (access through documentsApi.data)
}