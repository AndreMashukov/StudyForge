import { Rule } from "@shared-types";

export interface IRuleFormModal {
  ruleId?: string; // Undefined for create, ID for edit
  open: boolean;
  onClose: () => void;
  onSuccess?: (rule: Rule) => void;
}
