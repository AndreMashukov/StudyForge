import { RuleApplicability } from '@shared-types';

export interface ICompactRuleSelector {
  directoryId: string;
  operation: RuleApplicability;
  selectedRuleIds: string[];
  onSelectionChange: (ruleIds: string[]) => void;
  label?: string;
  showResetButton?: boolean;
  /** Extra lock from a parent (e.g. sibling rule section is saving). */
  controlsDisabled?: boolean;
  /** Reports when this selector is saving the folder's default prompts. */
  onBusyChange?: (busy: boolean) => void;
}
