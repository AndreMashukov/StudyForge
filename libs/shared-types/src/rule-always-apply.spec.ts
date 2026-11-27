import { describe, expect, it } from 'vitest';
import { defaultRuleIdsIn, ruleAppliesByDefault } from './rule-always-apply';

// Cells is inside Biology; Mitosis is inside Cells.

describe('ruleAppliesByDefault', () => {
  it('applies everywhere when no folder switched it off', () => {
    expect(ruleAppliesByDefault({ id: 'a' }, 'biology')).toBe(true);
    expect(ruleAppliesByDefault({ id: 'a' }, 'mitosis')).toBe(true);
  });

  it('switches off in that folder only, not in its subfolders or parents', () => {
    const rule = { id: 'a', alwaysApplyOffDirectoryIds: ['cells'] };
    expect(ruleAppliesByDefault(rule, 'biology')).toBe(true);
    expect(ruleAppliesByDefault(rule, 'cells')).toBe(false);
    expect(ruleAppliesByDefault(rule, 'mitosis')).toBe(true);
  });

  it('ignores the old "on" list', () => {
    const rule = {
      id: 'a',
      alwaysApplyOffDirectoryIds: ['cells'],
      alwaysApplyDirectoryIds: ['cells'],
    };
    expect(ruleAppliesByDefault(rule, 'cells')).toBe(false);
  });
});

describe('defaultRuleIdsIn', () => {
  it('lists the rules that apply by default in a folder', () => {
    const rules = [
      { id: 'a' },
      { id: 'b', alwaysApplyOffDirectoryIds: ['biology'] },
      { id: 'c', alwaysApplyOffDirectoryIds: ['cells'] },
    ];
    expect(defaultRuleIdsIn(rules, 'biology')).toEqual(['a', 'c']);
    expect(defaultRuleIdsIn(rules, 'cells')).toEqual(['a', 'b']);
    expect(defaultRuleIdsIn(rules, 'mitosis')).toEqual(['a', 'b', 'c']);
  });
});
