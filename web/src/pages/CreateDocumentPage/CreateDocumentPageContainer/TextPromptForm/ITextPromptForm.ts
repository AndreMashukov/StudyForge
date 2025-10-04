import { IAttachedFile } from '../../../../types/fileUpload';

export interface ITextPromptFormData {
  prompt: string;
}

export interface ITextPromptFormProps {
  isLoading: boolean;
  progress?: number;
  onSubmit: (data: ITextPromptFormData) => void;
  // File upload props
  attachedFiles: IAttachedFile[];
  onFilesSelected: (files: FileList) => void;
  onFileRemove: (fileId: string) => void;
  canAttachMore: boolean;
  totalTokens: number;
  contextSizeError: string | null;
}

