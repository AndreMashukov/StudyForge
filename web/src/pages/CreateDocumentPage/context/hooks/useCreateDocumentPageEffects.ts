import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { resetCreateDocumentPage } from '../../../../store/slices/createDocumentPageSlice';

/**
 * Ensures the Create Document page always starts from a clean state.
 * Resets the slice on mount and on unmount so values from a previous visit
 * (selected source, attached files, rule selections, errors, etc.) never leak in.
 */
export const useCreateDocumentPageEffects = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(resetCreateDocumentPage());

    return () => {
      dispatch(resetCreateDocumentPage());
    };
  }, [dispatch]);
};
