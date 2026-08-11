import { useGetDocumentContentQuery } from '../../../../../store/api/Documents';

export const useFetchDocumentContentData = (
  documentId: string | undefined,
  options?: { skip?: boolean },
) => {
  return useGetDocumentContentQuery(documentId || '', {
    skip: !documentId || Boolean(options?.skip),
    refetchOnMountOrArgChange: false,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });
};
