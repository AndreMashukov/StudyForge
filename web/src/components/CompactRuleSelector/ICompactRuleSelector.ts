import { RuleApplicability } from '@shared-types';

export interface ICompactRuleSelector {
  directoryId: string;
  operation: RuleApplicability;
  selectedRuleIds: string[];
  onSelectionChange: (ruleIds: string[]) => void;
  label?: string;
  showResetButton?: boolean;
}
