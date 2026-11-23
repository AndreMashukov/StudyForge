import { describe, expect, it } from 'vitest';
import type { UserOnboarding } from '@shared-types';
import {
  resolvePostSignInPath,
  shouldRedirectToWelcome,
  WELCOME_PATH,
} from './onboardingRedirect';

const starter = { turnsUsed: 0, documentsUsed: 0, documentIds: [] };
const pending: UserOnboarding = { version: 1, status: 'pending', starter };
const skipped: UserOnboarding = { version: 1, status: 'skipped', starter };

describe('resolvePostSignInPath', () => {
  it('sends pending accounts to the welcome screen', () => {
    expect(resolvePostSignInPath({ onboarding: pending }, '/usage')).toBe(
      WELCOME_PATH,
    );
  });

  it('keeps the normal destination for everyone else', () => {
    expect(resolvePostSignInPath({ onboarding: skipped }, '/usage')).toBe('/usage');
    expect(resolvePostSignInPath({}, '/')).toBe('/');
    expect(resolvePostSignInPath(null, '/')).toBe('/');
  });
});

describe('shouldRedirectToWelcome', () => {
  it('redirects pending accounts away from other routes only', () => {
    expect(shouldRedirectToWelcome({ onboarding: pending }, '/')).toBe(true);
    expect(shouldRedirectToWelcome({ onboarding: pending }, WELCOME_PATH)).toBe(
      false,
    );
  });

  it('never redirects existing or finished accounts', () => {
    expect(shouldRedirectToWelcome({}, '/')).toBe(false);
    expect(shouldRedirectToWelcome({ onboarding: skipped }, '/')).toBe(false);
    expect(shouldRedirectToWelcome(undefined, '/')).toBe(false);
  });
});
