import type { UserOnboarding } from '@shared-types';

export type WelcomePageView =
  | { type: 'loading' }
  /** Not a new account (or the welcome screen was skipped): go home. */
  | { type: 'leave' }
  | { type: 'pick' }
  | { type: 'build'; threadId: string };

/**
 * Which part of the welcome screen to show. A course that has started shows
 * its conversation again when the user comes back to the page.
 */
export function resolveWelcomePageView(params: {
  isProfileLoading: boolean;
  onboarding: UserOnboarding | undefined;
  /** The starter thread this page just started, before the profile refetches. */
  startedThreadId: string | undefined;
}): WelcomePageView {
  const { isProfileLoading, onboarding, startedThreadId } = params;
  if (startedThreadId) {
    return { type: 'build', threadId: startedThreadId };
  }
  if (isProfileLoading) {
    return { type: 'loading' };
  }
  if (!onboarding || onboarding.status === 'skipped') {
    return { type: 'leave' };
  }
  const threadId = onboarding.starter.threadId;
  if (onboarding.status !== 'pending' && threadId) {
    return { type: 'build', threadId };
  }
  return { type: 'pick' };
}

/** The subject a user can submit: trimmed, and long enough to plan a course. */
export function normalizeWelcomeSubject(value: string): string | null {
  const subject = value.trim().replace(/\s+/g, ' ');
  return subject.length >= 2 ? subject : null;
}
