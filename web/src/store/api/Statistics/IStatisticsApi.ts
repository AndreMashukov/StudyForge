import type { StatisticsDateRangeRequest } from '@shared-types';

export interface IStatisticsOverviewRequest extends StatisticsDateRangeRequest {
  attemptLimit: number;
}
