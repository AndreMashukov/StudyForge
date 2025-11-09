import { Rule, Directory } from '@shared-types';

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
  };
  handlers: {
    handleAssignRule: () => void;
    handleRemoveRule: (ruleId: string) => void;
    handleEditRule: (ruleId: string) => void;
    handleToggleCascadeView: () => void;
    handleCloseAssignModal: () => void;
  };
}
