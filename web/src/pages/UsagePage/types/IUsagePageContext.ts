import type { ISubscriptionPlanSummary, IUserUsageSummary } from '@shared-types';
import type { IUsagePageHandlers } from './IUsagePageHandlers';

export interface IUsagePageData {
  data: IUserUsageSummary | undefined;
  plans: ISubscriptionPlanSummary[];
  isLoading: boolean;
  isError: boolean;
  arePlansLoading: boolean;
  isPlansError: boolean;
  error: unknown;
  refetch: () => void;
}

export interface IUsagePageContext {
  usage: IUsagePageData;
  handlers: IUsagePageHandlers;
}
