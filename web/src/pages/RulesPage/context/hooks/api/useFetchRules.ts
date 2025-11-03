import { useGetRulesQuery } from '../../../../../store/api/Rules';

export const useFetchRules = () => {
  const queryResult = useGetRulesQuery();

  return {
    data: queryResult.data,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
};
