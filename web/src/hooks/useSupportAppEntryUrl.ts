import { useFeatureFlags } from './useFeatureFlags';

/** In-app Support route when the admin feature flag is on. */
export function useSupportAppEntryUrl(): string | undefined {
  const { supportEnabled } = useFeatureFlags();
  if (!supportEnabled) {
    return undefined;
  }
  return '/support';
}
