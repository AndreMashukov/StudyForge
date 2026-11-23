import { describe, expect, it } from 'vitest';
import type { UserOnboarding } from '@shared-types';
import { STARTER_COURSE_LIMITS } from '@shared-types';
import {
  applyStarterTurn,
  decideOnboardingInit,
  decideStarterDocumentClaim,
  decideStarterQuiz,
  decideStarterTurn,
  normalizeStarterSubject,
  ONBOARDING_MAX_ACCOUNT_AGE_MS,
  serializeUserOnboarding,
} from './user-onboarding-logic';

const NOW = Date.parse('2026-11-23T10:00:00.000Z');

function onboarding(overrides: Partial<UserOnboarding> = {}): UserOnboarding {
  return {
    version: 1,
    status: 'pending',
    starter: { turnsUsed: 0, documentsUsed: 0, documentIds: [] },
    ...overrides,
  };
}

function started(starter: Partial<UserOnboarding['starter']> = {}): UserOnboarding {
  return onboarding({
    status: 'started',
    starter: {
      threadId: 'thread-1',
      turnsUsed: 1,
      documentsUsed: 0,
      documentIds: [],
      ...starter,
    },
  });
}

describe('decideOnboardingInit', () => {
  it('starts onboarding for a new profile on a recent account', () => {
    expect(
      decideOnboardingInit({
        profileExists: false,
        authCreatedAtMs: NOW - 60_000,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('never starts onboarding for an existing profile', () => {
    expect(
      decideOnboardingInit({
        profileExists: true,
        authCreatedAtMs: NOW - 60_000,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it('skips old accounts and unknown creation times', () => {
    expect(
      decideOnboardingInit({
        profileExists: false,
        authCreatedAtMs: NOW - ONBOARDING_MAX_ACCOUNT_AGE_MS - 1,
        nowMs: NOW,
      }),
    ).toBe(false);
    expect(
      decideOnboardingInit({
        profileExists: false,
        authCreatedAtMs: undefined,
        nowMs: NOW,
      }),
    ).toBe(false);
  });
});

describe('decideStarterTurn', () => {
  it('begins from a pending account with the intent', () => {
    expect(
      decideStarterTurn({
        onboarding: onboarding(),
        threadId: 'thread-1',
        intent: 'starter_course',
      }),
    ).toEqual({ type: 'begin' });
  });

  it('continues on the starter thread with or without the intent', () => {
    for (const intent of ['starter_course', undefined] as const) {
      expect(
        decideStarterTurn({ onboarding: started(), threadId: 'thread-1', intent }),
      ).toEqual({ type: 'continue' });
    }
  });

  it('rejects the intent on another thread or without onboarding', () => {
    expect(
      decideStarterTurn({
        onboarding: started(),
        threadId: 'thread-2',
        intent: 'starter_course',
      }).type,
    ).toBe('reject');
    expect(
      decideStarterTurn({
        onboarding: undefined,
        threadId: 'thread-1',
        intent: 'starter_course',
      }).type,
    ).toBe('reject');
  });

  it('becomes an ordinary turn once the allowance is used', () => {
    expect(
      decideStarterTurn({
        onboarding: started({ turnsUsed: STARTER_COURSE_LIMITS.maxTurns }),
        threadId: 'thread-1',
        intent: undefined,
      }),
    ).toEqual({ type: 'none' });
    expect(
      decideStarterTurn({
        onboarding: started({ documentsUsed: STARTER_COURSE_LIMITS.maxDocuments }),
        threadId: 'thread-1',
        intent: undefined,
      }),
    ).toEqual({ type: 'none' });
    expect(
      decideStarterTurn({
        onboarding: onboarding(),
        threadId: 'thread-1',
        intent: undefined,
      }),
    ).toEqual({ type: 'none' });
  });
});

describe('applyStarterTurn', () => {
  it('records the subject and thread on the first turn', () => {
    const next = applyStarterTurn({
      onboarding: onboarding(),
      decision: 'begin',
      threadId: 'thread-1',
      subject: '  Spanish   for beginners ',
      nowIso: '2026-11-23T10:00:00.000Z',
    });
    expect(next.status).toBe('started');
    expect(next.subject).toBe('Spanish for beginners');
    expect(next.starter).toMatchObject({ threadId: 'thread-1', turnsUsed: 1 });
  });

  it('counts later turns', () => {
    const next = applyStarterTurn({
      onboarding: started({ turnsUsed: 2 }),
      decision: 'continue',
      threadId: 'thread-1',
      subject: 'ignored',
      nowIso: '2026-11-23T10:00:00.000Z',
    });
    expect(next.starter.turnsUsed).toBe(3);
    expect(next.subject).toBeUndefined();
  });
});

describe('decideStarterDocumentClaim', () => {
  it('allows documents up to the limit on the starter thread', () => {
    expect(
      decideStarterDocumentClaim({ onboarding: started(), threadId: 'thread-1' })
        .allowed,
    ).toBe(true);
    expect(
      decideStarterDocumentClaim({
        onboarding: started({ documentsUsed: STARTER_COURSE_LIMITS.maxDocuments }),
        threadId: 'thread-1',
      }).allowed,
    ).toBe(false);
    expect(
      decideStarterDocumentClaim({ onboarding: started(), threadId: 'thread-2' })
        .allowed,
    ).toBe(false);
  });
});

describe('decideStarterQuiz', () => {
  const two = started({ documentIds: ['doc-1', 'doc-2'], documentsUsed: 2 });

  it('waits while a document is still generating', () => {
    expect(
      decideStarterQuiz({
        onboarding: two,
        documentStates: { 'doc-1': 'completed', 'doc-2': 'pending' },
      }),
    ).toEqual({ type: 'wait' });
  });

  it('creates the quiz from the finished documents', () => {
    expect(
      decideStarterQuiz({
        onboarding: two,
        documentStates: { 'doc-1': 'completed', 'doc-2': 'failed' },
      }),
    ).toEqual({ type: 'create', documentIds: ['doc-1'] });
  });

  it('waits while a claimed document is not recorded yet', () => {
    expect(
      decideStarterQuiz({
        onboarding: started({ documentIds: ['doc-1'], documentsUsed: 2 }),
        documentStates: { 'doc-1': 'completed' },
      }),
    ).toEqual({ type: 'wait' });
  });

  it('skips when every document failed or the quiz was claimed', () => {
    expect(
      decideStarterQuiz({
        onboarding: two,
        documentStates: { 'doc-1': 'failed', 'doc-2': 'failed' },
      }),
    ).toEqual({ type: 'skip', reason: 'no_documents' });
    expect(
      decideStarterQuiz({
        onboarding: started({
          documentIds: ['doc-1'],
          quizClaimedAt: '2026-11-23T10:00:00.000Z',
        }),
        documentStates: { 'doc-1': 'completed' },
      }),
    ).toEqual({ type: 'skip', reason: 'already_claimed' });
  });
});

describe('normalizeStarterSubject', () => {
  it('collapses whitespace and caps the length', () => {
    expect(normalizeStarterSubject(' a  b ')).toBe('a b');
    expect(
      normalizeStarterSubject('x'.repeat(STARTER_COURSE_LIMITS.maxSubjectChars + 5)),
    ).toHaveLength(STARTER_COURSE_LIMITS.maxSubjectChars);
  });
});

describe('serializeUserOnboarding', () => {
  it('drops undefined fields', () => {
    expect(serializeUserOnboarding(onboarding())).toEqual({
      version: 1,
      status: 'pending',
      starter: { turnsUsed: 0, documentsUsed: 0, documentIds: [] },
    });
  });
});
