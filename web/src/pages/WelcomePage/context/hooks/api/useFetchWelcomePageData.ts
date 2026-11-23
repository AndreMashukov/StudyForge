import { useGetCurrentUserProfileQuery } from '../../../../../store/api/Auth/authApi';
import type { IWelcomePageData } from '../../../types/IWelcomePageContext';

/** While the course builds, refresh the profile so its folder, retry offer and status appear. */
export const WELCOME_BUILD_POLL_MS = 10_000;

export function useFetchWelcomePageData(): IWelcomePageData {
  const { data: profile } = useGetCurrentUserProfileQuery();
  const isBuilding = profile?.onboarding?.status === 'started';
  const { isLoading } = useGetCurrentUserProfileQuery(undefined, {
    pollingInterval: isBuilding ? WELCOME_BUILD_POLL_MS : 0,
  });
  return { onboarding: profile?.onboarding, isLoading };
}
