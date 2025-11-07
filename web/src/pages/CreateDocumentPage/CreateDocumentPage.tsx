import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateDocumentPageProvider } from './context/CreateDocumentPageProvider';
import { CreateDocumentPageContainer } from './CreateDocumentPageContainer';
import { setDirectoryId } from '../../store/slices/createDocumentPageSlice';

export const CreateDocumentPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  // Initialize directoryId from URL query parameter
  useEffect(() => {
    const directoryIdParam = searchParams.get('directoryId');
    dispatch(setDirectoryId(directoryIdParam));
  }, [searchParams, dispatch]);

  return (
    <ProtectedRoute>
      <CreateDocumentPageProvider>
        <CreateDocumentPageContainer />
      </CreateDocumentPageProvider>
    </ProtectedRoute>
  );
};