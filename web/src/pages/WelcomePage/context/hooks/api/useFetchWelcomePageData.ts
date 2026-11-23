import { useGetCurrentUserProfileQuery } from '../../../../../store/api/Auth/authApi';
import type { IWelcomePageData } from '../../../types/IWelcomePageContext';

export function useFetchWelcomePageData(): IWelcomePageData {
  const { data: profile, isLoading } = useGetCurrentUserProfileQuery();
  return { onboarding: profile?.onboarding, isLoading };
}
