import { useState, useMemo, useCallback } from 'react';
import { Rule } from '@shared-types';
import { RulesPageFilters } from '../../types/IRulesPageContext';
import { getRuleApplicabilityLabel } from '../../../../utils/ruleApplicabilityUtils';

export const useRulesPageFilters = (rules: Rule[] | undefined) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<RulesPageFilters>({
    tags: [],
    applicableTo: [],
    colors: [],
    showDefaultOnly: false,
  });

  const filteredRules = useMemo(() => {
    if (!rules) return [];

    return rules.filter((rule) => {
      // Search filter
      const query = searchQuery.trim().toLowerCase();

      if (query) {
        const normalizedTypeQuery = query.replace(/\s+/g, '_');
        const matchesName = rule.name.toLowerCase().includes(query);
        const matchesDescription = rule.description?.toLowerCase().includes(query);
        const matchesContent = rule.content.toLowerCase().includes(query);
        const matchesTags = rule.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesApplicability = rule.applicableTo.some((applicability) => {
          const label = getRuleApplicabilityLabel(applicability).toLowerCase();

          return label.includes(query) || applicability.toLowerCase().includes(normalizedTypeQuery);
        });
        
        if (!matchesName && !matchesDescription && !matchesContent && !matchesTags && !matchesApplicability) {
          return false;
        }
      }

      // Tag filter
      if (filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(filterTag => 
          rule.tags.includes(filterTag)
        );
        if (!hasMatchingTag) return false;
      }

      // Applicable to filter
      if (filters.applicableTo.length > 0) {
        const hasMatchingApplicability = filters.applicableTo.some(filterApp => 
          rule.applicableTo.includes(filterApp)
        );
        if (!hasMatchingApplicability) return false;
      }

      // Color filter
      if (filters.colors.length > 0) {
        if (!filters.colors.includes(rule.color)) return false;
      }

      // Default only filter
      if (filters.showDefaultOnly && !rule.isDefault) {
        return false;
      }

      return true;
    });
  }, [rules, searchQuery, filters]);

  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
  }, []);

  const handleFilterChange = useCallback((newFilters: RulesPageFilters) => {
    setFilters(newFilters);
  }, []);

  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
  }, []);

  return {
    searchQuery,
    viewMode,
    filters,
    filteredRules,
    handleSearchChange,
    handleFilterChange,
    handleViewModeChange,
  };
};
