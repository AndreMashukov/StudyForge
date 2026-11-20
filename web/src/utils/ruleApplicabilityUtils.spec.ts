import { describe, expect, it } from 'vitest';
import { RuleApplicability } from '@shared-types';
import {
  isRuleApplicability,
  toCurrentRuleApplicabilities,
} from './ruleApplicabilityUtils';

describe('rule applicability guard', () => {
  it('accepts current applicabilities only', () => {
    expect(isRuleApplicability(RuleApplicability.QUIZ)).toBe(true);
    expect(isRuleApplicability('followup')).toBe(false);
    expect(isRuleApplicability('chat')).toBe(false);
    expect(isRuleApplicability(42)).toBe(false);
  });

  it('drops retired values stored on older rules', () => {
    expect(toCurrentRuleApplicabilities(['quiz', 'followup', 'chat', 'flashcard'])).toEqual([
      RuleApplicability.QUIZ,
      RuleApplicability.FLASHCARD,
    ]);
    expect(toCurrentRuleApplicabilities(undefined)).toEqual([]);
  });
});
