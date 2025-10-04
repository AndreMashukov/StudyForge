/**
 * AttachedFileItem Props Interface
 */

import { IAttachedFile } from '../../../../../../types/fileUpload';

export interface IAttachedFileItemProps {
  file: IAttachedFile;
  onRemove: (fileId: string) => void;
}

