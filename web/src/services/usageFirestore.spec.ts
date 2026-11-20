import { describe, expect, it, vi } from 'vitest';
import { parseUsageSummaryFromFirestore } from './usageFirestore';

vi.mock('../config/firebase', () => ({ db: {} }));

const storedSummary = {
  periodKey: '2026-11',
  allowance: 100,
  reservedCredits: 0,
  spentCredits: 30,
  refundedCredits: 0,
  remainingCredits: 70,
  resetAt: '2026-12-01T00:00:00.000Z',
  usageLimitsSetupId: 'default',
};

describe('parseUsageSummaryFromFirestore', () => {
  it('skips retired kinds without losing the summary or its totals', () => {
    const summary = parseUsageSummaryFromFirestore({
      ...storedSummary,
      featureAvailability: [
        { kind: 'quiz', enabled: true, creditCost: 2, affordable: true },
        { kind: 'quizFollowup', enabled: true, creditCost: 1, affordable: true },
      ],
    });

    expect(summary?.featureAvailability.map((entry) => entry.kind)).toEqual(['quiz']);
    expect(summary?.spentCredits).toBe(30);
    expect(summary?.remainingCredits).toBe(70);
  });

  it('still rejects malformed entries', () => {
    expect(
      parseUsageSummaryFromFirestore({
        ...storedSummary,
        featureAvailability: [{ kind: 'quiz', enabled: 'yes', creditCost: 2, affordable: true }],
      }),
    ).toBeNull();
  });
});
