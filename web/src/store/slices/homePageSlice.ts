import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TimeframeKey } from '../../pages/InteractionStatsPage/types/IInteractionStatsPage';
import { formatUtcIsoDate } from '../../utils/dateUtils';

interface IHomePageState {
  timeframe: TimeframeKey;
  generationGrouping: 'date' | 'type';
  reportingDate: string;
}

const initialState: IHomePageState = {
  timeframe: 'month',
  generationGrouping: 'date',
  reportingDate: formatUtcIsoDate(),
};

const homePageSlice = createSlice({
  name: 'homePage',
  initialState,
  reducers: {
    setHomeTimeframe(state, action: PayloadAction<TimeframeKey>) {
      state.timeframe = action.payload;
    },
    setGenerationGrouping(
      state,
      action: PayloadAction<IHomePageState['generationGrouping']>,
    ) {
      state.generationGrouping = action.payload;
    },
    setReportingDate(state, action: PayloadAction<string>) {
      state.reportingDate = action.payload;
    },
  },
});
export const { setHomeTimeframe, setGenerationGrouping, setReportingDate } =
  homePageSlice.actions;
export default homePageSlice.reducer;
