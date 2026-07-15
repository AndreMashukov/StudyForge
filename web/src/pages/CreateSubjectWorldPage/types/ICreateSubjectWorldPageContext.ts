import { UseFormReturn } from 'react-hook-form';
import { IDocumentListResponse } from '../../../store/api/Documents/IDocumentsApi';
import { ICreateSubjectWorldFormData } from './ICreateSubjectWorldPageTypes';

export interface ICreateSubjectWorldPageContext {
  documentsApi: {
    data?: IDocumentListResponse;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  form: UseFormReturn<ICreateSubjectWorldFormData>;
  handlers: {
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  };
}
