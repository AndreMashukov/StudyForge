import { Directory } from "@shared-types";

export interface IEditDirectoryDialog {
  isOpen: boolean;
  onClose: () => void;
  directory: Directory | null;
  onSuccess: () => void;
}
