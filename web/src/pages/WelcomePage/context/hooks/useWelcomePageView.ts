import { useMemo } from 'react';
import { buildDirectoryPathWithOptionalName } from '../../../../utils/directoryUrl';
import type {
  IWelcomePageData,
  IWelcomePageHandlers,
} from '../../types/IWelcomePageContext';
import {
  resolveWelcomePageView,
  type WelcomePageView,
} from '../../utils/welcomePageView';

export function useWelcomePageView(
  data: IWelcomePageData,
  handlers: Pick<IWelcomePageHandlers, 'startedThreadId'>,
): { view: WelcomePageView; coursePath: string | null; samplePath: string | null } {
  const { onboarding, isLoading } = data;
  const { startedThreadId } = handlers;
  return useMemo(() => {
    const courseId = onboarding?.starter.directoryId;
    const sampleId = onboarding?.sampleDirectoryId;
    return {
      view: resolveWelcomePageView({
        isProfileLoading: isLoading,
        onboarding,
        startedThreadId,
      }),
      coursePath: courseId ? buildDirectoryPathWithOptionalName(courseId) : null,
      samplePath: sampleId ? buildDirectoryPathWithOptionalName(sampleId) : null,
    };
  }, [isLoading, onboarding, startedThreadId]);
}
