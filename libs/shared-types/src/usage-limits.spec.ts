import { describe, expect, it } from 'vitest';
import {
  calculateRemainingCredits,
  resolveLivePeriodAllowance,
} from './usage-limits';

describe('resolveLivePeriodAllowance', () => {
  it('uses the live setup allowance after a mid-period group change', () => {
    expect(resolveLivePeriodAllowance(20_000)).toBe(20_000);
    expect(
      calculateRemainingCredits({
        allowance: resolveLivePeriodAllowance(20_000),
        reservedCredits: 0,
        spentCredits: 25,
      }),
    ).toBe(19_975);
  });
});
