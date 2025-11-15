import { Rule } from '@shared-types';

export interface IRulesPageContext {
  rulesApi: {
    data: Rule[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
  };
  handlers: {
    handleCreateRule: () => void;
    handleEditRule: (rule: Rule) => void;
    handleDeleteRule: (ruleId: string) => void;
    handleFilterChange: (filters: RulesPageFilters) => void;
    handleViewModeChange: (mode: 'grid' | 'list') => void;
    handleSearchChange: (search: string) => void;
    isCreateModalOpen: boolean;
    isEditModalOpen: boolean;
    selectedRule: Rule | null;
    handleCloseCreateModal: () => void;
    handleCloseEditModal: () => void;
  };
  filters: RulesPageFilters;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  filteredRules: Rule[];
}

export interface RulesPageFilters {
  tags: string[];
  applicableTo: string[];
  colors: string[];
  showDefaultOnly: boolean;
}
