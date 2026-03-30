import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateDiagramQuizPageData = () => {
  return useGetUserDocumentsQuery(undefined);
};
