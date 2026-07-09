import { describe, expect, it } from 'vitest';
import {
  buildRateLimitDocId,
  evaluateGenerationRateLimit,
  evaluateRateLimitState,
  normalizeLimiterKey,
  resolveRateLimitGenerationKind,
} from './generation-rate-limit-logic';
import { ONE_HOUR_MS } from './generation-rate-limit-profiles';

describe('generation-rate-limit-logic', () => {
  it('normalizes limiter keys for Firestore doc IDs', () => {
    expect(normalizeLimiterKey('firebase_user/123')).toBe('firebase_user_123');
    expect(buildRateLimitDocId('quiz', 'firebase_user/123')).toBe('quiz_firebase_user_123');
  });

  it('resolves job kinds to generation kinds', () => {
    expect(resolveRateLimitGenerationKind('slideDeck')).toBe('slideDeckText');
    expect(resolveRateLimitGenerationKind('artifactAgent')).toBe('diagramQuiz');
    expect(resolveRateLimitGenerationKind('quiz')).toBe('quiz');
  });

  it('blocks requests during cooldown', () => {
    const now = 1_000_000;
    const decision = evaluateGenerationRateLimit('quiz', {
      lastRequestAtMs: now - 2_000,
      windowStartAtMs: now - 30_000,
      requestCount: 1,
    }, now);

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.retryAfterSeconds).toBe(8);
      expect(decision.message).toContain('cooling down');
    }
  });

  it('resets the hourly window after one hour', () => {
    const now = ONE_HOUR_MS + 5_000;
    const decision = evaluateGenerationRateLimit('quiz', {
      lastRequestAtMs: now - 20_000,
      windowStartAtMs: 0,
      requestCount: 60,
    }, now);

    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.nextState.requestCount).toBe(1);
      expect(decision.nextState.windowStartAtMs).toBe(now);
    }
  });

  it('blocks when hourly limit is reached', () => {
    const now = 500_000;
    const decision = evaluateRateLimitState(
      {
        lastRequestAtMs: now - 20_000,
        windowStartAtMs: now - 30 * 60 * 1000,
        requestCount: 60,
      },
      {
        cooldownMs: 10_000,
        hourlyLimit: 60,
        windowMs: ONE_HOUR_MS,
        cooldownMessage: 'cooldown',
        hourlyMessage: 'hourly',
      },
      now
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.message).toBe('hourly');
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('uses separate buckets per generation kind', () => {
    const quizDocId = buildRateLimitDocId('quiz', 'key_a');
    const flashcardsDocId = buildRateLimitDocId('flashcards', 'key_a');

    expect(quizDocId).not.toBe(flashcardsDocId);
    expect(quizDocId).toBe('quiz_key_a');
    expect(flashcardsDocId).toBe('flashcards_key_a');
  });

  it('uses separate buckets per limiter key', () => {
    const userBucket = buildRateLimitDocId('quiz', 'firebase_uid_a');
    const apiKeyBucket = buildRateLimitDocId('quiz', 'api_key_1');

    expect(userBucket).not.toBe(apiKeyBucket);
  });
});
