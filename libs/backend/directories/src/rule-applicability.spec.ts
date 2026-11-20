import { describe, expect, it } from 'vitest';
import { RuleApplicability } from '@shared-types';
import { isRuleApplicability, parseStoredRuleApplicability } from './rule-applicability';

describe('rule-applicability', () => {
  it('accepts current applicability values', () => {
    expect(isRuleApplicability('quiz')).toBe(true);
    expect(isRuleApplicability('slide_deck')).toBe(true);
  });

  it('rejects retired and unknown values', () => {
    expect(isRuleApplicability('followup')).toBe(false);
    expect(isRuleApplicability('chat')).toBe(false);
    expect(isRuleApplicability(42)).toBe(false);
  });

  it('drops retired values from stored applicableTo', () => {
    expect(parseStoredRuleApplicability(['quiz', 'followup', 'chat', 'prompt'])).toEqual([
      RuleApplicability.QUIZ,
      RuleApplicability.PROMPT,
    ]);
  });

  it('returns an empty list for a missing or malformed field', () => {
    expect(parseStoredRuleApplicability(undefined)).toEqual([]);
    expect(parseStoredRuleApplicability('quiz')).toEqual([]);
  });
});
