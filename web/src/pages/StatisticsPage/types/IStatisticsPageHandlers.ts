import {
  HideStatisticsFailureRequest,
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';

export type StatisticsTab = 'overview' | 'performance' | 'time';

export interface IStatisticsPageHandlers {
  activeTab: StatisticsTab;
  handleActiveTabChange: (tab: StatisticsTab) => void;
  handleSetTimeRange: (range: StatisticsTimeRangeKey) => void;
  handleSetQuizType: (type: StatisticsQuizTypeFilter) => void;
  handleBackToStatistics: () => void;
  handleLoadMoreAttempts: () => Promise<void>;
  handleLoadMoreFlashcardFailures: () => Promise<void>;
  handleHideFailure: (request: HideStatisticsFailureRequest) => Promise<void>;
  isLoadingMoreAttempts: boolean;
  isLoadingMoreFlashcards: boolean;
}
