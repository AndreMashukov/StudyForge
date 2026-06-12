import { Page } from '../../components/Page';
import { StatisticsPageProvider } from './context/StatisticsPageProvider';
import { StatisticsPageContainer } from './StatisticsPageContainer';

export const StatisticsPage = () => (
  <Page showSidebar={true}>
    <StatisticsPageProvider>
      <StatisticsPageContainer />
    </StatisticsPageProvider>
  </Page>
);