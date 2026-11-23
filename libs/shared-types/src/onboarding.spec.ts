import { describe, expect, it } from 'vitest';
import { startAgentTurnRequestSchema } from './agent-turn';
import {
  isOnboardingPending,
  parseUserOnboarding,
  USER_ONBOARDING_VERSION,
} from './onboarding';

describe('parseUserOnboarding', () => {
  it('treats a missing field as an existing account', () => {
    expect(parseUserOnboarding(undefined)).toBeUndefined();
    expect(parseUserOnboarding(null)).toBeUndefined();
  });

  it('fills defaults for a new pending account', () => {
    const onboarding = parseUserOnboarding({ status: 'pending' });
    expect(onboarding).toEqual({
      version: USER_ONBOARDING_VERSION,
      status: 'pending',
      starter: { turnsUsed: 0, documentsUsed: 0, documentIds: [], retriesUsed: 0 },
    });
    expect(isOnboardingPending(onboarding)).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(parseUserOnboarding({ status: 'done' })).toBeUndefined();
    expect(isOnboardingPending(undefined)).toBe(false);
  });
});

describe('startAgentTurnRequestSchema intent', () => {
  const base = {
    message: 'Spanish for beginners',
    threadId: 'thread-123456',
    turnId: 'turn-1234567',
  };

  it('accepts the starter course in workspace scope', () => {
    const parsed = startAgentTurnRequestSchema.safeParse({
      ...base,
      intent: 'starter_course',
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses the starter course with a directory or UI context', () => {
    expect(
      startAgentTurnRequestSchema.safeParse({
        ...base,
        intent: 'starter_course',
        scope: 'directory',
        directoryId: 'dir-1',
      }).success,
    ).toBe(false);
    expect(
      startAgentTurnRequestSchema.safeParse({
        ...base,
        intent: 'starter_course',
        promptContext: { type: 'directory', directoryId: 'dir-1' },
      }).success,
    ).toBe(false);
  });

  it('refuses an unknown intent', () => {
    expect(
      startAgentTurnRequestSchema.safeParse({ ...base, intent: 'free_stuff' })
        .success,
    ).toBe(false);
  });
});
