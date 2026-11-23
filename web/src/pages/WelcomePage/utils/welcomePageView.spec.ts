import { describe, expect, it } from 'vitest';
import type { UserOnboarding } from '@shared-types';
import {
  normalizeWelcomeSubject,
  resolveWelcomePageView,
} from './welcomePageView';

const starter = { turnsUsed: 0, documentsUsed: 0, documentIds: [] };

function onboarding(overrides: Partial<UserOnboarding>): UserOnboarding {
  return { version: 1, status: 'pending', starter, ...overrides };
}

describe('resolveWelcomePageView', () => {
  it('shows the subject picker for a pending account', () => {
    expect(
      resolveWelcomePageView({
        isProfileLoading: false,
        onboarding: onboarding({}),
        startedThreadId: undefined,
      }),
    ).toEqual({ type: 'pick' });
  });

  it('shows the course being built right after starting', () => {
    expect(
      resolveWelcomePageView({
        isProfileLoading: false,
        onboarding: onboarding({}),
        startedThreadId: 'thread-1',
      }),
    ).toEqual({ type: 'build', threadId: 'thread-1' });
  });

  it('reopens a started course from the stored thread', () => {
    expect(
      resolveWelcomePageView({
        isProfileLoading: false,
        onboarding: onboarding({
          status: 'started',
          starter: { ...starter, threadId: 'thread-9' },
        }),
        startedThreadId: undefined,
      }),
    ).toEqual({ type: 'build', threadId: 'thread-9' });
  });

  it('sends existing and skipped accounts away', () => {
    expect(
      resolveWelcomePageView({
        isProfileLoading: false,
        onboarding: undefined,
        startedThreadId: undefined,
      }),
    ).toEqual({ type: 'leave' });
    expect(
      resolveWelcomePageView({
        isProfileLoading: false,
        onboarding: onboarding({ status: 'skipped' }),
        startedThreadId: undefined,
      }),
    ).toEqual({ type: 'leave' });
  });

  it('waits for the profile', () => {
    expect(
      resolveWelcomePageView({
        isProfileLoading: true,
        onboarding: undefined,
        startedThreadId: undefined,
      }),
    ).toEqual({ type: 'loading' });
  });
});

describe('normalizeWelcomeSubject', () => {
  it('trims and rejects too-short subjects', () => {
    expect(normalizeWelcomeSubject('  Spanish   verbs ')).toBe('Spanish verbs');
    expect(normalizeWelcomeSubject(' a ')).toBeNull();
  });
});
