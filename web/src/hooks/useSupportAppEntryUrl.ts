import { getSupportAppUrl } from '../config/supportApp';
import { useFeatureFlags } from './useFeatureFlags';

/** Support URL only when the feature flag is on and the env URL is set. */
export function useSupportAppEntryUrl(): string | undefined {
  const supportAppUrl = getSupportAppUrl();
  const { supportEnabled } = useFeatureFlags();
  if (!supportAppUrl || !supportEnabled) {
    return undefined;
  }
  return supportAppUrl;
}
