import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateSequenceQuizPageData = () => {
  return useGetUserDocumentsQuery(undefined);
};
