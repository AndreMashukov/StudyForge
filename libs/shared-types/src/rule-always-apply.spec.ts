import { describe, expect, it } from 'vitest';
import { alwaysApplyRuleIdsIn, ruleAlwaysAppliesIn } from './rule-always-apply';

describe('rule always apply', () => {
  const rules = [
    { id: 'a', alwaysApplyDirectoryIds: ['biology'] },
    { id: 'b', alwaysApplyDirectoryIds: ['cells'] },
    { id: 'c' },
  ];

  it('applies only in the exact folders listed', () => {
    expect(ruleAlwaysAppliesIn(rules[0], 'biology')).toBe(true);
    expect(ruleAlwaysAppliesIn(rules[0], 'cells')).toBe(false);
    expect(ruleAlwaysAppliesIn(rules[2], 'biology')).toBe(false);
    expect(ruleAlwaysAppliesIn(rules[0], null)).toBe(false);
  });

  it('lists the rules that start ticked in a folder', () => {
    expect(alwaysApplyRuleIdsIn(rules, 'cells')).toEqual(['b']);
    expect(alwaysApplyRuleIdsIn(rules, 'physics')).toEqual([]);
  });
});
