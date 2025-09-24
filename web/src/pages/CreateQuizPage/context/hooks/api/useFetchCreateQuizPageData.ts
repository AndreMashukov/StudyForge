import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateQuizPageData = () => {
  // API hook - self-contained, manage own data dependencies
  const documentsApi = useGetUserDocumentsQuery();
  
  return documentsApi;
};