import { UseFormReturn } from 'react-hook-form';
import { ICreateQuizFormData } from '../../../store/slices/createQuizPageSlice';

export interface ICreateQuizPageContext {
  documentsApi: {
    data: unknown;
    isLoading: boolean;
    error: unknown;
  };
  form: UseFormReturn<ICreateQuizFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    isSubmitting: boolean;
  };
  // DON'T include: formData (managed by React Hook Form)
  // DON'T include: documents (access through documentsApi.data)
}