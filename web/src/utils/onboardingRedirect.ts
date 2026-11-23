import type { IUserProfile } from '@shared-types';
import { isOnboardingPending } from '@shared-types';

/** The first-run screen for new accounts. */
export const WELCOME_PATH = '/welcome';

/**
 * Where to send a signed-in user: new accounts that have not used the welcome
 * screen go there first; everyone else goes to `fallbackPath`.
 */
export function resolvePostSignInPath(
  profile: Pick<IUserProfile, 'onboarding'> | null | undefined,
  fallbackPath: string,
): string {
  return isOnboardingPending(profile?.onboarding) ? WELCOME_PATH : fallbackPath;
}

/** Whether ProtectedRoute should redirect this route to the welcome screen. */
export function shouldRedirectToWelcome(
  profile: Pick<IUserProfile, 'onboarding'> | null | undefined,
  pathname: string,
): boolean {
  return isOnboardingPending(profile?.onboarding) && pathname !== WELCOME_PATH;
}
