import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '../../utils/ProtectedRoute';
import { CreateDocumentPageProvider } from './context/CreateDocumentPageProvider';
import { CreateDocumentPageContainer } from './CreateDocumentPageContainer';
import { setSelectedDirectory } from '../../store/slices/directorySlice';
import {
  setDirectoryId,
  setPromptRules,
  setScrapingRules,
  setUploadRules,
  setSelectedSource,
} from '../../store/slices/createDocumentPageSlice';

export const CreateDocumentPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initialize directoryId from URL query parameter and reset rule selections
  // so that stale rules from a previous directory do not carry over.
  useEffect(() => {
    const directoryIdParam = searchParams.get('directoryId');
    if (!directoryIdParam) {
      navigate('/documents', { replace: true });
      return;
    }
    dispatch(setSelectedDirectory(directoryIdParam));
    dispatch(setDirectoryId(directoryIdParam));
    dispatch(setSelectedSource('textPrompt'));
    dispatch(setPromptRules([]));
    dispatch(setScrapingRules([]));
    dispatch(setUploadRules([]));
  }, [searchParams, dispatch, navigate]);

  return (
    <ProtectedRoute>
      <CreateDocumentPageProvider>
        <CreateDocumentPageContainer />
      </CreateDocumentPageProvider>
    </ProtectedRoute>
  );
};