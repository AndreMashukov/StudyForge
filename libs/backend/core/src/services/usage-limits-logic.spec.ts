import { describe, expect, it } from 'vitest';
import {
  buildUsagePeriodResetAt,
  calculateRemainingCredits,
  createDefaultFeaturePolicies,
  type GenerationKind,
} from '@shared-types';
import {
  evaluateFeatureAffordability,
  evaluateUsageLimitDecision,
  resolveUsageGenerationKind,
} from './usage-limits-logic';

const activeBilling = {
  payAsYouGoEnabled: true,
  hasPaymentMethod: true,
  monthlyCapCents: 2_000,
  pricePerCreditCents: 5,
  overageAmountCents: 0,
  reservedOverageAmountCents: 0,
};

describe('usage-limits-logic', () => {
  it('builds UTC calendar month period keys', () => {
    expect(buildUsagePeriodResetAt('2026-08')).toBe('2026-09-01T00:00:00.000Z');
  });

  it('blocks disabled features', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: false, creditCost: 10 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 0,
        refundedCredits: 0,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('FEATURE_DISABLED');
    }
  });

  it('blocks when credits are insufficient and pay-as-you-go is disabled', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: {
        allowance: 100,
        reservedCredits: 10,
        spentCredits: 80,
        refundedCredits: 0,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('INSUFFICIENT_CREDITS');
      expect(decision.remainingCredits).toBe(10);
    }
  });

  it('allows affordable actions and multiplies quantity from included credits', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 10 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 20,
        refundedCredits: 0,
      },
      quantity: 3,
    });

    expect(decision).toEqual({
      allowed: true,
      credits: 30,
      includedCredits: 30,
      overageCredits: 0,
      overageAmountCents: 0,
    });
  });

  it('allows overage when included credits are exhausted and cap allows it', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 100,
        refundedCredits: 0,
      },
      billing: activeBilling,
    });

    expect(decision).toEqual({
      allowed: true,
      credits: 20,
      includedCredits: 0,
      overageCredits: 20,
      overageAmountCents: 100,
    });
  });

  it('uses a split when some included credits remain', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 90,
        refundedCredits: 0,
      },
      billing: activeBilling,
    });

    expect(decision).toEqual({
      allowed: true,
      credits: 20,
      includedCredits: 10,
      overageCredits: 10,
      overageAmountCents: 50,
    });
  });

  it('blocks overage when the spending cap would be exceeded', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 100,
        refundedCredits: 0,
      },
      billing: {
        ...activeBilling,
        overageAmountCents: 1_990,
        reservedOverageAmountCents: 0,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('OVERAGE_CAP_EXCEEDED');
    }
  });

  it('requires a payment method before overage can be used', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: {
        allowance: 100,
        reservedCredits: 0,
        spentCredits: 100,
        refundedCredits: 0,
      },
      billing: {
        ...activeBilling,
        hasPaymentMethod: false,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('PAYMENT_METHOD_REQUIRED');
    }
  });

  it('evaluates feature affordability with overage', () => {
    const affordability = evaluateFeatureAffordability({
      policy: { enabled: true, creditCost: 20 },
      remainingIncluded: 0,
      billing: activeBilling,
    });

    expect(affordability).toEqual({ affordable: true, usesOverage: true });
  });

  it('resolves job and alias kinds to usage generation kinds', () => {
    expect(resolveUsageGenerationKind('slideDeck')).toBe('slideDeckText');
    expect(resolveUsageGenerationKind('directoryAgent')).toBe('directoryAgent');
    expect(resolveUsageGenerationKind('agentExecutor')).toBe('agentExecutor');
  });

  it('computes remaining credits from reserved and spent totals', () => {
    expect(
      calculateRemainingCredits({
        allowance: 100,
        reservedCredits: 10,
        spentCredits: 25,
      }),
    ).toBe(65);
  });

  it('creates default feature policies for all generation kinds', () => {
    const policies = createDefaultFeaturePolicies({
      disabledKinds: ['slideDeckText' as GenerationKind],
    });

    expect(policies.slideDeckText.enabled).toBe(false);
    expect(policies.quiz.enabled).toBe(true);
    expect(policies.quiz.creditCost).toBeGreaterThan(0);
  });
});
