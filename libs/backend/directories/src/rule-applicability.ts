import { RuleApplicability } from '@shared-types';

const RULE_APPLICABILITY_VALUES = new Set<string>(Object.values(RuleApplicability));

export function isRuleApplicability(value: unknown): value is RuleApplicability {
  return typeof value === 'string' && RULE_APPLICABILITY_VALUES.has(value);
}

/**
 * Keeps only current `RuleApplicability` values. Stored rules (and requests from
 * older clients) may still hold retired values such as `followup` and `chat`.
 */
export function parseStoredRuleApplicability(value: unknown): RuleApplicability[] {
  return Array.isArray(value) ? value.filter(isRuleApplicability) : [];
}
