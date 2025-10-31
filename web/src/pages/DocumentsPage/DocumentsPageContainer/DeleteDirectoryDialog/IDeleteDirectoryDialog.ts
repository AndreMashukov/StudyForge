import { Directory } from "@shared-types";

export interface IDeleteDirectoryDialog {
  isOpen: boolean;
  onClose: () => void;
  directory: Directory | null;
  onSuccess: () => void;
}
