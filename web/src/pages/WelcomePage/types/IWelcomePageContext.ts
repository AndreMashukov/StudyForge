import type { UserOnboarding } from '@shared-types';
import type { WelcomePageView } from '../utils/welcomePageView';

export interface IWelcomePageData {
  onboarding: UserOnboarding | undefined;
  isLoading: boolean;
}

export interface IWelcomePageHandlers {
  subject: string;
  isStarting: boolean;
  isSkipping: boolean;
  error: string | null;
  startedThreadId: string | undefined;
  handleSubjectChange: (value: string) => void;
  handleStartCourse: (subject?: string) => void;
  handleSkip: () => void;
  handleAgentMutated: () => void;
}

export interface IWelcomePageContext {
  data: IWelcomePageData;
  handlers: IWelcomePageHandlers;
  view: WelcomePageView;
  /** Library path of the course folder, once the agent created it. */
  coursePath: string | null;
  /** Library path of the instant sample folder. */
  samplePath: string | null;
}
