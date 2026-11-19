import { describe, expect, it } from 'vitest';
import { normalizeSlideParam, parseSlideParam } from './slideParam';

describe('parseSlideParam', () => {
  it('maps 1-based values to 0-based indexes', () => {
    expect(parseSlideParam('1', 5)).toBe(0);
    expect(parseSlideParam('5', 5)).toBe(4);
  });

  it('clamps out-of-range values', () => {
    expect(parseSlideParam('99', 5)).toBe(4);
    expect(parseSlideParam('0', 5)).toBe(0);
    expect(parseSlideParam('-3', 5)).toBe(0);
  });

  it('falls back to the first slide for missing or invalid values', () => {
    expect(parseSlideParam(null, 5)).toBe(0);
    expect(parseSlideParam('abc', 5)).toBe(0);
    expect(parseSlideParam('3', 0)).toBe(0);
  });
});

describe('normalizeSlideParam', () => {
  it('returns null when no rewrite is needed', () => {
    expect(normalizeSlideParam(null, 5)).toBeNull();
    expect(normalizeSlideParam('3', 5)).toBeNull();
    expect(normalizeSlideParam('99', 0)).toBeNull();
  });

  it('returns the canonical value for invalid or out-of-range params', () => {
    expect(normalizeSlideParam('99', 5)).toBe('5');
    expect(normalizeSlideParam('0', 5)).toBe('1');
    expect(normalizeSlideParam('abc', 5)).toBe('1');
    expect(normalizeSlideParam('03', 5)).toBe('3');
  });
});
