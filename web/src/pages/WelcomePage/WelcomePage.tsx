import { WelcomePageProvider } from './context/WelcomePageProvider';
import { WelcomePageContainer } from './WelcomePageContainer';

/** First-run screen: pick a subject and get a free starter course. */
export const WelcomePage = () => (
  <WelcomePageProvider>
    <WelcomePageContainer />
  </WelcomePageProvider>
);
