import { describe, expect, it } from 'vitest';
import { RuleApplicability, RuleColor } from '@shared-types';
import {
  parseOptionalRuleApplicabilityArray,
  parseOptionalRuleColor,
  parseRuleApplicabilityArray,
  parseRuleColor,
  parseStringArray,
} from './rule-tool-args';

describe('rule-tool-args', () => {
  it('accepts slide_deck applicability', () => {
    expect(parseRuleApplicabilityArray(['slide_deck'])).toEqual([
      RuleApplicability.SLIDE_DECK,
    ]);
  });

  it('accepts multiple applicability values', () => {
    expect(parseRuleApplicabilityArray(['chat', 'slide_deck'])).toEqual([
      RuleApplicability.CHAT,
      RuleApplicability.SLIDE_DECK,
    ]);
  });

  it('rejects invalid applicability values', () => {
    expect(() => parseRuleApplicabilityArray(['not_a_kind'])).toThrow(
      'Invalid applicability'
    );
  });

  it('rejects empty applicability arrays', () => {
    expect(() => parseRuleApplicabilityArray([])).toThrow(
      'applicableTo must include at least one value'
    );
  });

  it('parses optional applicability arrays', () => {
    expect(parseOptionalRuleApplicabilityArray(undefined)).toBeUndefined();
    expect(parseOptionalRuleApplicabilityArray(['quiz'])).toEqual([
      RuleApplicability.QUIZ,
    ]);
  });

  it('parses rule colors', () => {
    expect(parseRuleColor('purple')).toBe(RuleColor.PURPLE);
    expect(parseOptionalRuleColor(undefined)).toBeUndefined();
  });

  it('rejects invalid rule colors', () => {
    expect(() => parseRuleColor('magenta')).toThrow('Invalid rule color');
  });

  it('parses string tag arrays', () => {
    expect(parseStringArray(['math', 'slides'])).toEqual(['math', 'slides']);
    expect(() => parseStringArray(['math', 1])).toThrow(
      'tags must be an array of strings'
    );
  });
});
