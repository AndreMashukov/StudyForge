import { Directory } from "@shared-types";

export interface IFolderCard {
  directory: Directory;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onManageRules?: () => void;
}
