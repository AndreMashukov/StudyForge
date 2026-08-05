import { Rule } from "@shared-types";

export interface IRuleFormModal {
  open: boolean;
  onClose: () => void;
  onSuccess?: (rule: Rule) => void;
}
