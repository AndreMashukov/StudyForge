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
  isRetrying: boolean;
  /** The retry was sent; the offer is hidden until the profile catches up. */
  retryRequested: boolean;
  error: string | null;
  startedThreadId: string | undefined;
  handleSubjectChange: (value: string) => void;
  handleStartCourse: (subject?: string) => void;
  handleSkip: () => void;
  /** Asks the agent to recreate the documents after they all failed (free). */
  handleRetryCourse: (threadId: string) => void;
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
  /** Every course document failed and a free retry is waiting. */
  retryAvailable: boolean;
}
