import React from 'react';
import { RulesPageContext } from './RulesPageContext';
import { IRulesPageContext } from '../types/IRulesPageContext';
import { useFetchRules } from './hooks/api/useFetchRules';
import { useRulesPageHandlers } from './hooks/useRulesPageHandlers';
import { useRulesPageFilters } from './hooks/useRulesPageFilters';

interface RulesPageProviderProps {
  children: React.ReactNode;
}

export const RulesPageProvider: React.FC<RulesPageProviderProps> = ({ children }) => {
  // API hooks - fetch all rules
  const rulesApi = useFetchRules();

  // Handler hooks - manage create/edit/delete operations
  const handlers = useRulesPageHandlers();

  // Filter hooks - manage search, filters, and view mode
  const {
    searchQuery,
    viewMode,
    filters,
    filteredRules,
    handleSearchChange,
    handleFilterChange,
    handleViewModeChange,
  } = useRulesPageFilters(rulesApi.data);

  const contextValue: IRulesPageContext = {
    rulesApi,
    handlers: {
      ...handlers,
      handleFilterChange,
      handleViewModeChange,
      handleSearchChange,
    },
    filters,
    viewMode,
    searchQuery,
    filteredRules,
  };

  return (
    <RulesPageContext.Provider value={contextValue}>
      {children}
    </RulesPageContext.Provider>
  );
};
