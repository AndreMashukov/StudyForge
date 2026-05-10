import { useMemo } from 'react';
import { useGetRulesQuery } from '../store/api/Rules/rulesApi';

export const useRuleNames = (ruleIds?: string[]) => {
  const hasRuleIds = (ruleIds?.length ?? 0) > 0;
  const { data: rules = [] } = useGetRulesQuery(undefined, { skip: !hasRuleIds });

  return useMemo(() => {
    if (!ruleIds || ruleIds.length === 0) return [];

    const ruleNamesById = new Map(rules.map((rule) => [rule.id, rule.name]));
    return ruleIds.map((ruleId) => ruleNamesById.get(ruleId) ?? 'Unknown rule');
  }, [ruleIds, rules]);
};