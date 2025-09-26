import { useGetDocumentContentQuery } from '../../../../../store/api/Documents';

export const useFetchDocumentContentData = (documentId: string | undefined) => {
  return useGetDocumentContentQuery(documentId || '', {
    skip: !documentId,
    refetchOnMountOrArgChange: false,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });
};