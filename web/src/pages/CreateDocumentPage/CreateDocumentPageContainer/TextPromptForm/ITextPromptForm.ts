import { IAttachedFile } from '../../../../types/fileUpload';
import { DocumentEnhanced } from '@shared-types';

export interface ITextPromptFormData {
  prompt: string;
  ruleIds?: string[];
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
  
  // Document selector props
  userDocuments: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onDocumentToggle: (documentId: string) => void;
  isLoadingDocuments: boolean;
  
  // Rule selector props
  directoryId: string | null;
  selectedRuleIds: string[];
  onRuleIdsChange: (ruleIds: string[]) => void;
}

