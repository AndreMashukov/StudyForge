import { UseFormReturn } from 'react-hook-form';
import { ICreateFlashcardFormData } from './ICreateFlashcardPageTypes';

export interface ICreateFlashcardPageContext {
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
  form: UseFormReturn<ICreateFlashcardFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
}
