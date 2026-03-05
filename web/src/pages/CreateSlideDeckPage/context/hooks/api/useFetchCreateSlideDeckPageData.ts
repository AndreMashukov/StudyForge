import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents/documentsApi';

export const useFetchCreateSlideDeckPageData = () => {
  const documentsApi = useGetUserDocumentsQuery();
  return documentsApi;
};
