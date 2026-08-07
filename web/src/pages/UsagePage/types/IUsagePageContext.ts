import type { IUserUsageSummary } from '@shared-types';

export interface IUsagePageData {
  data: IUserUsageSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export interface IUsagePageContext {
  usage: IUsagePageData;
}
