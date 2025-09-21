import { useMemo } from 'react';
import { useGetUserDocumentsQuery, useSearchDocumentsQuery } from '../../../../../store/api/Documents';

export const useFetchDocuments = (searchQuery?: string) => {
  const shouldSearchQuery = Boolean(searchQuery && searchQuery.trim().length > 0);
  
  const {
    data: allDocuments,
    isLoading: isLoadingAll,
    error: errorAll,
  } = useGetUserDocumentsQuery(undefined, {
    skip: shouldSearchQuery,
  });

  const {
    data: searchResults,
    isLoading: isLoadingSearch,
    error: errorSearch,
  } = useSearchDocumentsQuery(searchQuery || '', {
    skip: !shouldSearchQuery,
  });

  const documents = useMemo(() => {
    if (shouldSearchQuery && searchResults) {
      return searchResults.documents;
    }
    return allDocuments?.documents || [];
  }, [shouldSearchQuery, searchResults, allDocuments]);

  const isLoading = shouldSearchQuery ? isLoadingSearch : isLoadingAll;
  const error = shouldSearchQuery ? errorSearch : errorAll;

  return {
    documents,
    isLoading,
    error,
    total: shouldSearchQuery ? searchResults?.total : allDocuments?.total,
  };
};