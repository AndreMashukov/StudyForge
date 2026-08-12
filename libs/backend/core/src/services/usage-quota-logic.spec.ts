import { describe, expect, it } from 'vitest';
import {
  buildUsageDayKey,
  buildUsageDayResetAt,
  calculateRemainingDailySlideDecks,
  calculateRemainingStorageBytes,
} from '@shared-types';
import {
  evaluateDailySlideDeckQuotaDecision,
  evaluateStorageQuotaDecision,
} from './usage-quota-logic';

describe('usage-quota-logic', () => {
  it('builds UTC day keys and reset timestamps', () => {
    expect(buildUsageDayKey(new Date('2026-08-12T15:30:00.000Z'))).toBe('2026-08-12');
    expect(buildUsageDayResetAt('2026-08-12')).toBe('2026-08-13T00:00:00.000Z');
  });

  it('blocks storage writes when quota would be exceeded', () => {
    const decision = evaluateStorageQuotaDecision({
      limitBytes: 100,
      usedBytes: 90,
      requestedBytes: 20,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('STORAGE_LIMIT_EXCEEDED');
      expect(decision.remainingBytes).toBe(10);
    }
  });

  it('allows storage writes when quota has room', () => {
    const decision = evaluateStorageQuotaDecision({
      limitBytes: 100,
      usedBytes: 90,
      requestedBytes: 10,
    });

    expect(decision).toEqual({ allowed: true, remainingBytes: 10 });
  });

  it('blocks daily slide deck generation when the limit is reached', () => {
    const decision = evaluateDailySlideDeckQuotaDecision({
      limit: 1,
      dayKey: '2026-08-12',
      state: {
        reservedSlideDecks: 0,
        completedSlideDecks: 1,
        refundedSlideDecks: 0,
      },
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe('DAILY_SLIDE_DECK_LIMIT_EXCEEDED');
      expect(decision.resetAt).toBe('2026-08-13T00:00:00.000Z');
    }
  });

  it('computes remaining storage and daily slide deck counts', () => {
    expect(calculateRemainingStorageBytes({ limitBytes: 100, usedBytes: 30 })).toBe(70);
    expect(
      calculateRemainingDailySlideDecks({
        limit: 5,
        reservedSlideDecks: 1,
        completedSlideDecks: 2,
      }),
    ).toBe(2);
  });
});
