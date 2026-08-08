import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDocument, setSelectedDirectory } from '../../../../store/slices/directorySlice';
import { buildTreeDirectoryNavigationState } from '../../../../utils/directoryNavigationState';
import { buildDirectoryPathWithOptionalName } from '../../../../utils/directoryUrl';
import { useDeleteDocument } from './api/useDeleteDocument';
import { CreateArtifactModalType } from '../../../../components/CreateArtifactModal';

function navigateToCreateArtifact(
  navigate: ReturnType<typeof useNavigate>,
  artifactType: CreateArtifactModalType,
  documentId: string,
  directoryId?: string,
) {
  if (!directoryId) {
    navigate('/documents');
    return;
  }

  const tabByType: Record<CreateArtifactModalType, string> = {
    quizzes: 'quizzes',
    cards: 'cards',
    slides: 'slides',
    diagramQuizzes: 'diagramQuizzes',
    sequenceQuizzes: 'sequenceQuizzes',
  };

  navigate(buildDirectoryPathWithOptionalName(directoryId, undefined, tabByType[artifactType]), {
    state: {
      openCreateArtifact: {
        artifactType,
        directoryId,
        preselectedDocumentIds: [documentId],
      },
    },
  });
}

export const useDocumentsPageHandlers = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { deleteDocument } = useDeleteDocument();
  const [, setSearchParams] = useSearchParams();
  
  const handleViewDocument = useCallback((documentId: string) => {
    dispatch(setSelectedDocument(documentId));
    navigate(`/document/${documentId}`);
  }, [navigate, dispatch]);

  const handleCreateQuizFromDocument = useCallback((documentId: string, directoryId?: string) => {
    navigateToCreateArtifact(navigate, 'quizzes', documentId, directoryId);
  }, [navigate]);

  const handleGenerateFlashcardsFromDocument = useCallback((documentId: string, directoryId?: string) => {
    navigateToCreateArtifact(navigate, 'cards', documentId, directoryId);
  }, [navigate]);

  const handleGenerateSlideDeckFromDocument = useCallback((documentId: string, directoryId?: string) => {
    navigateToCreateArtifact(navigate, 'slides', documentId, directoryId);
  }, [navigate]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    // Use window.confirm with explicit declaration
    const confirmDelete = window.confirm('Are you sure you want to delete this document? This action cannot be undone.');
    if (confirmDelete) {
      await deleteDocument(documentId);
    }
  }, [deleteDocument]);

  const handleSelectDirectory = useCallback((directoryId: string | null, directoryName?: string) => {
    dispatch(setSelectedDirectory(directoryId));
    if (directoryId) {
      // Use replace so the back button skips tree-browsing and returns to the
      // page that mounted the tree (e.g. /documents), not the previously
      // clicked folder.
      navigate(buildDirectoryPathWithOptionalName(directoryId, directoryName), {
        replace: true,
        state: buildTreeDirectoryNavigationState(),
      });
    } else {
      navigate('/documents', { replace: true });
      setSearchParams({}, { replace: true });
    }
  }, [dispatch, navigate, setSearchParams]);

  return {
    handleViewDocument,
    handleDeleteDocument,
    handleCreateQuizFromDocument,
    handleGenerateFlashcardsFromDocument,
    handleGenerateSlideDeckFromDocument,
    handleSelectDirectory,
  };
};