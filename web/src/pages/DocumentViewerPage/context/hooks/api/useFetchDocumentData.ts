import { useGetDocumentQuery } from '../../../../../store/api/Documents';

export const useFetchDocumentData = (documentId: string | undefined) => {
  return useGetDocumentQuery(documentId || '', {
    skip: !documentId,
    refetchOnMountOrArgChange: false,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });
};