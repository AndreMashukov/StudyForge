import { describe, expect, it } from 'vitest';
import {
  buildUsagePeriodResetAt,
  calculateRemainingCredits,
  createDefaultFeaturePolicies,
  type GenerationKind,
} from '@shared-types';
import {
  evaluateUsageLimitDecision,
  resolveUsageGenerationKind,
} from './usage-limits-logic';

describe('usage-limits-logic', () => {
  it('builds UTC calendar month period keys', () => {
    expect(buildUsagePeriodResetAt('2026-08')).toBe('2026-09-01T00:00:00.000Z');
  });

  it('blocks disabled features', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: false, creditCost: 10 },
      period: { allowance: 100, reservedCredits: 0, spentCredits: 0, refundedCredits: 0 },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('FEATURE_DISABLED');
    }
  });

  it('blocks when credits are insufficient', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 20 },
      period: { allowance: 100, reservedCredits: 10, spentCredits: 80, refundedCredits: 0 },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('INSUFFICIENT_CREDITS');
      expect(decision.remainingCredits).toBe(10);
    }
  });

  it('allows affordable actions and multiplies quantity', () => {
    const decision = evaluateUsageLimitDecision({
      policy: { enabled: true, creditCost: 10 },
      period: { allowance: 100, reservedCredits: 0, spentCredits: 20, refundedCredits: 0 },
      quantity: 3,
    });

    expect(decision).toEqual({ allowed: true, credits: 30 });
  });

  it('resolves job and alias kinds to usage generation kinds', () => {
    expect(resolveUsageGenerationKind('slideDeck')).toBe('slideDeckText');
    expect(resolveUsageGenerationKind('directoryAgent')).toBe('directoryChat');
  });

  it('computes remaining credits from reserved and spent totals', () => {
    expect(
      calculateRemainingCredits({
        allowance: 100,
        reservedCredits: 10,
        spentCredits: 25,
      })
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
