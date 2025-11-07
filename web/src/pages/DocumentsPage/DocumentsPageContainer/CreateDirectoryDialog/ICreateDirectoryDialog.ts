export interface ICreateDirectoryDialog {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  onSuccess: (directoryId: string) => void;
}

export interface CreateDirectoryFormData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
}
