import { UseFormReturn } from 'react-hook-form';
import { ICreateSlideDeckFormData } from './ICreateSlideDeckPageTypes';

export interface ICreateSlideDeckPageContext {
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
  form: UseFormReturn<ICreateSlideDeckFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
}
