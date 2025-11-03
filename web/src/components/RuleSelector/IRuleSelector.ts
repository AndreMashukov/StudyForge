import { RuleApplicability } from "@shared-types";

export interface IRuleSelector {
  directoryId: string;
  operation: RuleApplicability;
  selectedRuleIds: string[];
  onSelectionChange: (ruleIds: string[]) => void;
  compact?: boolean; // For mobile/sidebar usage
}
