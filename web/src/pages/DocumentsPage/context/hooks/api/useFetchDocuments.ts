import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetUserDocumentsQuery, useSearchDocumentsQuery } from '../../../../../store/api/Documents';
import { selectSearchQuery } from '../../../../../store/slices/documentsPageSlice';

export const useFetchDocuments = () => {
  const searchQuery = useSelector(selectSearchQuery);
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