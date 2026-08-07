import { UsagePageProvider } from './context/UsagePageProvider';
import { UsagePageContainer } from './UsagePageContainer';

export const UsagePage = () => (
  <UsagePageProvider>
    <UsagePageContainer />
  </UsagePageProvider>
);
