import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateSubjectWorldPageData = () => {
  return useGetUserDocumentsQuery(undefined);
};
