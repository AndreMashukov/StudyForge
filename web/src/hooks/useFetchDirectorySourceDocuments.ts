import { useSearchParams } from 'react-router-dom';
import { IGetUserDocumentsArgs } from '../store/api/Documents/documentsApi';
import { usePaginatedUserDocuments } from './usePaginatedUserDocuments';

const ARTIFACT_SOURCE_DOCUMENTS_LIMIT = 100;

/**
 * Loads documents for artifact creation forms. When opened from a directory
 * (`?directoryId=`), scopes the query server-side so folders are not empty
 * after the global 100-document cap.
 */
export const useFetchDirectorySourceDocuments = () => {
  const [searchParams] = useSearchParams();
  const directoryId = searchParams.get('directoryId')?.trim();

  const queryArgs: IGetUserDocumentsArgs = directoryId
    ? { directoryId, limit: ARTIFACT_SOURCE_DOCUMENTS_LIMIT }
    : { limit: ARTIFACT_SOURCE_DOCUMENTS_LIMIT };

  const paginated = usePaginatedUserDocuments(queryArgs);

  return {
    data: {
      documents: paginated.documents,
      total: paginated.total ?? paginated.documents.length,
      hasMore: paginated.hasMore,
    },
    isLoading: paginated.isLoading,
    isFetching: paginated.isFetching,
    error: paginated.error,
    refetch: () => {
      void paginated.refetch();
    },
    hasMore: paginated.hasMore,
    isLoadingMore: paginated.isLoadingMore,
    loadMore: paginated.loadMore,
    loadError: paginated.loadError,
  };
};
