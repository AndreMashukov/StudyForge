import { Rule, Directory } from '@shared-types';
import { IBulkDetachDirectoryRules } from '../context/hooks/useBulkDetachDirectoryRules';

export interface IDirectoryRulesPageContext {
  state: {
    directoryId: string;
    directory: Directory | null;
    directRules: Rule[];
    inheritedRules: { [directoryId: string]: Rule[] };
    allRules: Rule[];
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
    /** Turns always apply on or off for this rule in this folder only. */
    handleToggleAlwaysApply: (rule: Rule) => void;
    handleToggleCascadeView: () => void;
    handleCloseAssignModal: () => void;
  };
  bulkDetach: IBulkDetachDirectoryRules;
}
