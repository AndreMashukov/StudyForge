import { describe, expect, it } from 'vitest';
import {
  calculateAgentLoopCredits,
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

describe('calculateAgentLoopCredits', () => {
  const pricePerCreditCents = 2.5;

  it('converts known provider USD with a 2x markup', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 0.4,
        unknownCallCount: 0,
        pricePerCreditCents,
        reservedCredits: 50,
      }),
    ).toBe(32);
  });

  it('adds one credit per unknown-cost call', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 0.4,
        unknownCallCount: 2,
        pricePerCreditCents,
        reservedCredits: 50,
      }),
    ).toBe(34);
  });

  it('caps at the reserved hold', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 2,
        unknownCallCount: 0,
        pricePerCreditCents,
        reservedCredits: 50,
      }),
    ).toBe(50);
  });

  it('refunds the hold when no billable loop calls ran', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 0,
        unknownCallCount: 0,
        pricePerCreditCents,
        reservedCredits: 50,
        billableEventCount: 0,
      }),
    ).toBe(0);
  });

  it('charges a 1-credit floor when calls ran but cost is zero', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 0,
        unknownCallCount: 0,
        pricePerCreditCents,
        reservedCredits: 50,
        billableEventCount: 3,
      }),
    ).toBe(1);
  });

  it('ceils fractional USD to whole credits', () => {
    expect(
      calculateAgentLoopCredits({
        knownCostUsd: 0.01,
        unknownCallCount: 0,
        pricePerCreditCents,
        reservedCredits: 50,
      }),
    ).toBe(1);
  });
});
