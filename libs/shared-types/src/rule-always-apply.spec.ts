import { describe, expect, it } from 'vitest';
import {
  defaultRuleIdsIn,
  planAlwaysApplyChange,
  ruleAppliesByDefault,
} from './rule-always-apply';

// Chains are folder first, then parents: Cells is inside Biology.
const BIOLOGY = ['biology'];
const CELLS = ['cells', 'biology'];
const MITOSIS = ['mitosis', 'cells', 'biology'];

describe('ruleAppliesByDefault', () => {
  it('applies everywhere when no folder made a choice', () => {
    expect(ruleAppliesByDefault({ id: 'a' }, BIOLOGY)).toBe(true);
    expect(ruleAppliesByDefault({ id: 'a' }, MITOSIS)).toBe(true);
  });

  it('carries a switch-off down to subfolders', () => {
    const rule = { id: 'a', alwaysApplyOffDirectoryIds: ['cells'] };
    expect(ruleAppliesByDefault(rule, BIOLOGY)).toBe(true);
    expect(ruleAppliesByDefault(rule, CELLS)).toBe(false);
    expect(ruleAppliesByDefault(rule, MITOSIS)).toBe(false);
  });

  it('lets a subfolder switch it back on', () => {
    const rule = {
      id: 'a',
      alwaysApplyOffDirectoryIds: ['biology'],
      alwaysApplyDirectoryIds: ['mitosis'],
    };
    expect(ruleAppliesByDefault(rule, BIOLOGY)).toBe(false);
    expect(ruleAppliesByDefault(rule, CELLS)).toBe(false);
    expect(ruleAppliesByDefault(rule, MITOSIS)).toBe(true);
  });

  it('lists the rules that apply by default in a folder', () => {
    const rules = [
      { id: 'a' },
      { id: 'b', alwaysApplyOffDirectoryIds: ['biology'] },
      { id: 'c', alwaysApplyOffDirectoryIds: ['cells'] },
    ];
    expect(defaultRuleIdsIn(rules, BIOLOGY)).toEqual(['a', 'c']);
    expect(defaultRuleIdsIn(rules, CELLS)).toEqual(['a']);
  });
});

describe('planAlwaysApplyChange', () => {
  it('stores a choice that differs from the parents', () => {
    expect(planAlwaysApplyChange({ id: 'a' }, CELLS, false)).toEqual({
      on: 'remove',
      off: 'add',
    });
    expect(
      planAlwaysApplyChange(
        { id: 'a', alwaysApplyOffDirectoryIds: ['biology'] },
        CELLS,
        true,
      ),
    ).toEqual({ on: 'add', off: 'remove' });
  });

  it('clears the choice when it matches the parents, so the folder follows them again', () => {
    expect(
      planAlwaysApplyChange(
        { id: 'a', alwaysApplyOffDirectoryIds: ['cells'] },
        CELLS,
        true,
      ),
    ).toEqual({ on: 'remove', off: 'remove' });
    expect(
      planAlwaysApplyChange(
        { id: 'a', alwaysApplyOffDirectoryIds: ['biology'] },
        CELLS,
        false,
      ),
    ).toEqual({ on: 'remove', off: 'remove' });
  });
});
