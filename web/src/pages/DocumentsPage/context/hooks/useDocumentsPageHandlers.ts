import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDocumentId } from '../../../../store/slices/documentsPageSlice';

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleCreateDocument = () => {
    navigate('/documents/create');
  };

  const handleViewDocument = (documentId: string) => {
    dispatch(setSelectedDocumentId(documentId));
    navigate(`/document/${documentId}`);
  };

  const handleCreateQuizFromDocument = (documentId: string) => {
    // Navigate to quiz creation with document ID
    navigate(`/quiz/create?documentId=${documentId}`);
  };

  const handleDeleteDocument = async (documentId: string) => {
    // This will be handled by the component using useDeleteDocument hook
    console.log('Delete document:', documentId);
  };

  const handleSearchChange = (query: string) => {
    // This will be handled by the search state management
    console.log('Search query:', query);
  };

  return {
    handleCreateDocument,
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleSearchChange,
  };
};