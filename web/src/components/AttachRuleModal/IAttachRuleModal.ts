import { Directory } from "@shared-types";

export interface IAttachRuleModal {
  directory: Directory;
  open: boolean;
  onClose: () => void;
  onCreateNew: () => void;
}
