import { Rule } from "@shared-types";

export interface IRuleFormModal {
  ruleId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: (rule: Rule) => void;
}
