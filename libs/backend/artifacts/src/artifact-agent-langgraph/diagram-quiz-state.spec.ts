import { describe, expect, it } from 'vitest';

import { keepFiniteNumber } from './diagram-quiz-state';

describe('keepFiniteNumber', () => {
  it('keeps a finite incoming value', () => {
    expect(keepFiniteNumber(3, 4)).toBe(4);
  });

  it('does not add one to the current value', () => {
    expect(keepFiniteNumber(3, undefined)).toBe(3);
  });

  it('falls back to zero when both sides are missing', () => {
    expect(keepFiniteNumber(undefined, undefined)).toBe(0);
  });

  it('rejects non-finite incoming values', () => {
    expect(keepFiniteNumber(2, Number.NaN)).toBe(2);
  });
});
