import { StatisticsQuizTypeFilter, StatisticsTimeRangeKey } from '@shared-types';

export type StatisticsTab = 'overview' | 'performance' | 'time';

export interface IStatisticsPageHandlers {
  activeTab: StatisticsTab;
  handleActiveTabChange: (tab: StatisticsTab) => void;
  handleSetTimeRange: (range: StatisticsTimeRangeKey) => void;
  handleSetQuizType: (type: StatisticsQuizTypeFilter) => void;
  handleRefetchAll: () => void;
  handleBackToStatistics: () => void;
}
