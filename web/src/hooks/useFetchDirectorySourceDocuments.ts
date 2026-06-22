import { useSearchParams } from 'react-router-dom';
import {
  useGetUserDocumentsQuery,
  IGetUserDocumentsArgs,
} from '../store/api/Documents/documentsApi';

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

  return useGetUserDocumentsQuery(queryArgs);
};
