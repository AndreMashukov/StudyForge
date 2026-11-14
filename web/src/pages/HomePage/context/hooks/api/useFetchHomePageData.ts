import { useMemo } from 'react';
import { useAppSelector } from '../../../../../hooks/redux';
import { useAuth } from '../../../../../contexts/AuthContext';
import { useGetInteractionStatsQuery } from '../../../../../store/api/InteractionTracking/interactionTrackingApi';
import { useGetDirectoryTreeQuery } from '../../../../../store/api/Directory/DirectoryApi';
import { useGetCompletedDashboardArtifactsQuery } from '../../../../../store/api/Dashboard/DashboardApi';
import {
  dashboardDateRange,
  dashboardFilteredRange,
  HEATMAP_DAY_COUNT,
} from '../../../utils/dashboardUtils';

export const useFetchHomePageData = () => {
  const { user } = useAuth();
  const { timeframe, reportingDate } = useAppSelector(
    (state) => state.homePage,
  );
  const range = useMemo(
    () => dashboardFilteredRange(reportingDate, timeframe),
    [reportingDate, timeframe],
  );
  const historyRange = useMemo(
    () => dashboardDateRange(reportingDate, HEATMAP_DAY_COUNT),
    [reportingDate],
  );
  const options = {
    skip: !user,
    refetchOnMountOrArgChange: true,
    pollingInterval: 60_000,
    skipPollingIfUnfocused: true,
  };
  const activity = useGetInteractionStatsQuery(
    { startDate: range.startDate, endDate: range.endDate },
    options,
  );
  const history = useGetInteractionStatsQuery(
    { startDate: historyRange.startDate, endDate: historyRange.endDate },
    options,
  );
  const directories = useGetDirectoryTreeQuery(undefined, { skip: !user });
  const generations = useGetCompletedDashboardArtifactsQuery(
    { startDate: range.startDate, endDate: range.endDate },
    options,
  );
  return { range, historyRange, activity, history, directories, generations };
};
