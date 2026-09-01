import { RuleApplicability, RuleColor } from '@shared-types';

const RULE_APPLICABILITY_VALUES = new Set<string>(Object.values(RuleApplicability));
const RULE_COLOR_VALUES = new Set<string>(Object.values(RuleColor));

export function isRuleApplicability(value: string): value is RuleApplicability {
  return RULE_APPLICABILITY_VALUES.has(value);
}

export function isRuleColor(value: string): value is RuleColor {
  return RULE_COLOR_VALUES.has(value);
}

export function parseRuleApplicabilityArray(value: unknown): RuleApplicability[] {
  if (!Array.isArray(value)) {
    throw new Error('applicableTo must be an array of applicability strings');
  }

  const result: RuleApplicability[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isRuleApplicability(item)) {
      throw new Error(`Invalid applicability: ${String(item)}`);
    }
    result.push(item);
  }

  if (result.length === 0) {
    throw new Error('applicableTo must include at least one value');
  }

  return result;
}

export function parseOptionalRuleApplicabilityArray(
  value: unknown
): RuleApplicability[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseRuleApplicabilityArray(value);
}

export function parseRuleColor(value: unknown): RuleColor {
  if (typeof value !== 'string' || !isRuleColor(value)) {
    throw new Error(`Invalid rule color: ${String(value)}`);
  }
  return value;
}

export function parseOptionalRuleColor(value: unknown): RuleColor | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseRuleColor(value);
}

export function parseStringArray(value: unknown, fieldName = 'tags'): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error(`${fieldName} must be an array of strings`);
    }
    result.push(item);
  }

  return result;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error('isDefault must be a boolean');
  }
  return value;
}

export const RULE_APPLICABILITY_ENUM = Object.values(RuleApplicability);
export const RULE_COLOR_ENUM = Object.values(RuleColor);
