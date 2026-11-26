import { Rule, Directory } from '@shared-types';
import { IBulkDetachDirectoryRules } from '../context/hooks/useBulkDetachDirectoryRules';

export interface IDirectoryRulesPageContext {
  state: {
    directoryId: string;
    directory: Directory | null;
    directRules: Rule[];
    inheritedRules: { [directoryId: string]: Rule[] };
    allRules: Rule[];
    /** Rules that apply by default in this folder (always apply). */
    defaultRuleIds: string[];
    loading: boolean;
    error: string | null;
    isAssignModalOpen: boolean;
    isCascadeViewOpen: boolean;
    isAlwaysApplyUpdating: boolean;
  };
  handlers: {
    handleAssignRule: () => void;
    handleRemoveRule: (ruleId: string) => void;
    handleEditRule: (ruleId: string) => void;
    /** Switches this rule on or off by default in this folder and below. */
    handleToggleAlwaysApply: (rule: Rule) => void;
    handleToggleCascadeView: () => void;
    handleCloseAssignModal: () => void;
  };
  bulkDetach: IBulkDetachDirectoryRules;
}
