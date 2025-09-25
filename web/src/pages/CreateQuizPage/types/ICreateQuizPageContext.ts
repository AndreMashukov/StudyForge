import { UseFormReturn } from 'react-hook-form';
import { ICreateQuizFormData } from '../../../store/slices/createQuizPageSlice';

export interface ICreateQuizPageContext {
  documentsApi: {
    data?: {
      documents: Array<{
        id: string;
        title: string;
        content?: string;
      }>;
      total: number;
      hasMore: boolean;
    };
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateQuizFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
  // DON'T include: formData (managed by React Hook Form)
  // DON'T include: documents (access through documentsApi.data)
}