import { Directory } from '@shared-types';

export interface IMoveDirectoryDialog {
  isOpen: boolean;
  onClose: () => void;
  directory: Directory | null;
  onSuccess: () => void;
}
