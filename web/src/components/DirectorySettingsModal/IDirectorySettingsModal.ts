import { Directory } from "@shared-types";

export interface IDirectorySettingsModal {
  directory: Directory;
  open: boolean;
  onClose: () => void;
}
