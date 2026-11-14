import { useAppDispatch } from '../../../../hooks/redux';
import {
  setGenerationGrouping,
  setHomeTimeframe,
} from '../../../../store/slices/homePageSlice';
import type { IHomePageHandlers } from '../../types/IHomePageContext';

export const useHomePageHandlers = (): IHomePageHandlers => {
  const dispatch = useAppDispatch();
  const handleTimeframeChange = (value: string) => {
    if (value === 'day' || value === 'week' || value === 'month')
      dispatch(setHomeTimeframe(value));
  };
  const handleGenerationGroupingChange = (value: string) => {
    if (value === 'date' || value === 'type')
      dispatch(setGenerationGrouping(value));
  };
  return { handleTimeframeChange, handleGenerationGroupingChange };
};
