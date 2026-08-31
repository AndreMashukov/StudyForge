import { useGetUsageSummaryQuery } from '../../../../../store/api/Usage/usageApi';
import { useListSubscriptionPlansQuery } from '../../../../../store/api/Billing/billingApi';
import type { IUsagePageData } from '../../../types/IUsagePageContext';

export function useFetchUsagePageData(): IUsagePageData {
  const { data, isLoading, isError, error, refetch } = useGetUsageSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const {
    data: plans,
    isLoading: arePlansLoading,
    isError: isPlansError,
  } = useListSubscriptionPlansQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  return {
    data,
    plans: plans ?? [],
    isLoading,
    isError,
    arePlansLoading,
    isPlansError,
    error,
    refetch,
  };
}
