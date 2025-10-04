/**
 * AttachedFilesList Props Interface
 */

import { IAttachedFile } from '../../../../../types/fileUpload';

export interface IAttachedFilesListProps {
  files: IAttachedFile[];
  onRemoveFile: (fileId: string) => void;
  totalTokens: number;
  maxTokens: number;
  contextSizeError: string | null;
}

