import { useGetUsageSummaryQuery } from '../../../../../store/api/Usage/usageApi';
import type { IUsagePageData } from '../../../types/IUsagePageContext';

export function useFetchUsagePageData(): IUsagePageData {
  const { data, isLoading, isError, error, refetch } = useGetUsageSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
