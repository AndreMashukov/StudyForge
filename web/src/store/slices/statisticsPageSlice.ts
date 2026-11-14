import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  StatisticsQuizTypeFilter,
  StatisticsTimeRangeKey,
} from '@shared-types';

export interface IStatisticsPageState {
  timeRange: StatisticsTimeRangeKey;
  quizType: StatisticsQuizTypeFilter;
  activeTab: 'overview' | 'performance';
  attemptLimit: number;
  search: string;
  sort: 'recent' | 'repeats';
  selectedFailureKey: string | null;
}

const initialState: IStatisticsPageState = {
  timeRange: '30d',
  quizType: 'all',
  activeTab: 'overview',
  attemptLimit: 50,
  search: '',
  sort: 'recent',
  selectedFailureKey: null,
};
const statisticsPageSlice = createSlice({
  name: 'statisticsPage',
  initialState,
  reducers: {
    setStatisticsTimeRange(
      state,
      action: PayloadAction<StatisticsTimeRangeKey>,
    ) {
      state.timeRange = action.payload;
      state.attemptLimit = 50;
      state.selectedFailureKey = null;
    },
    setStatisticsQuizType(
      state,
      action: PayloadAction<StatisticsQuizTypeFilter>,
    ) {
      state.quizType = action.payload;
      state.attemptLimit = 50;
      state.selectedFailureKey = null;
    },
    setStatisticsTab(
      state,
      action: PayloadAction<IStatisticsPageState['activeTab']>,
    ) {
      state.activeTab = action.payload;
    },
    loadMoreStatistics(state) {
      state.attemptLimit += 50;
    },
    setStatisticsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.selectedFailureKey = null;
    },
    setStatisticsSort(
      state,
      action: PayloadAction<IStatisticsPageState['sort']>,
    ) {
      state.sort = action.payload;
    },
    selectStatisticsFailure(state, action: PayloadAction<string>) {
      state.selectedFailureKey = action.payload;
    },
  },
});
export const {
  setStatisticsTimeRange,
  setStatisticsQuizType,
  setStatisticsTab,
  loadMoreStatistics,
  setStatisticsSearch,
  setStatisticsSort,
  selectStatisticsFailure,
} = statisticsPageSlice.actions;
export default statisticsPageSlice.reducer;
