import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateFlashcardPageData = () => {
  const documentsApi = useGetUserDocumentsQuery();
  
  return documentsApi;
};
