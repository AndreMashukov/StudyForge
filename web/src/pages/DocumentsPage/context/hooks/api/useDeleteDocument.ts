import { useDeleteDocumentMutation } from '../../../../../store/api/Documents';
import { useDispatch } from 'react-redux';
import { setIsDeletingDocument, setError } from '../../../../../store/slices/directorySlice';

export const useDeleteDocument = () => {
  const dispatch = useDispatch();
  const [deleteDocumentMutation] = useDeleteDocumentMutation();

  const deleteDocument = async (documentId: string) => {
    try {
      dispatch(setIsDeletingDocument(true));
      await deleteDocumentMutation({ documentId }).unwrap();
      dispatch(setError(null));
    } catch (error) {
      console.error('Error deleting document:', error);
      dispatch(setError('Failed to delete document'));
    } finally {
      dispatch(setIsDeletingDocument(false));
    }
  };

  return { deleteDocument };
};