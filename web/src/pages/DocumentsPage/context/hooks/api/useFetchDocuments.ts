import { useMemo } from 'react';
import { useGetUserDocumentsQuery } from '../../../../../store/api/Documents';
import { IDocumentsApi } from '../../../types/IDocumentsPageContext';

export const useFetchDocuments = (): IDocumentsApi => {
  const {
    data: allDocuments,
    isLoading,
    error,
  } = useGetUserDocumentsQuery();

  const documents = useMemo(() => {
    return allDocuments?.documents || [];
  }, [allDocuments]);

  return {
    documents,
    isLoading,
    error,
    total: allDocuments?.total,
  };
};