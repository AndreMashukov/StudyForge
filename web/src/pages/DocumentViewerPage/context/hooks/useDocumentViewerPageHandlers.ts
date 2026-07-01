import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { TocItem, exportToPDF } from '../../../../components/MarkdownRenderer';
import { downloadMarkdownFile } from '../../../../utils/downloadUtils';
import {
  AI_REVISION_EXISTING_CONTENT_MAX,
  DocumentEnhanced,
} from '@shared-types';
import {
  setTocItems,
  toggleToc,
  setIsExporting,
  selectIsExporting,
  setQuestionAsking,
  setQuestionAnswer,
  setQuestionError,
  setEditAiState,
  setEditPreviewContent,
  setEditError,
  setIsApplyingRevision,
  resetEditPanelState,
  resetEditPreview,
  selectEditPreviewContent,
} from '../../../../store/slices/documentViewerPageSlice';
import { useAskDocumentQuestionMutation } from '../../../../store/api/DocumentQuestion/DocumentQuestionApi';
import {
  useReviseDocumentWithAIMutation,
  useUpdateDocumentMutation,
} from '../../../../store/api/Documents/documentsApi';
import { useToast } from '../../../../components/Toast';

interface UseDocumentViewerPageHandlersProps {
  document: DocumentEnhanced | undefined;
  contentRef: React.RefObject<HTMLDivElement | null>;
  content?: string;
}

export const useDocumentViewerPageHandlers = ({
  document,
  contentRef,
  content,
}: UseDocumentViewerPageHandlersProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const isExporting = useSelector(selectIsExporting);
  const editPreviewContent = useSelector(selectEditPreviewContent);
  const [askDocumentQuestion] = useAskDocumentQuestionMutation();
  const [reviseDocumentWithAI] = useReviseDocumentWithAIMutation();
  const [updateDocument] = useUpdateDocumentMutation();

  const handleCreateQuizFromDocument = useCallback(
    (docId: string) => {
      const directoryId = document?.directoryId;
      const params = new URLSearchParams({ documentId: docId });
      if (directoryId) {
        params.set('directoryId', directoryId);
      }
      navigate(`/quiz/create?${params.toString()}`);
    },
    [navigate, document?.directoryId]
  );

  const handleGenerateFlashcards = useCallback(
    (docId: string) => {
      const directoryId = document?.directoryId;
      const params = new URLSearchParams({ documentId: docId });
      if (directoryId) {
        params.set('directoryId', directoryId);
      }
      navigate(`/flashcards/create?${params.toString()}`);
    },
    [navigate, document?.directoryId]
  );

  const handleGenerateSlideDeck = useCallback(
    (docId: string) => {
      const directoryId = document?.directoryId;
      const params = new URLSearchParams({ documentId: docId });
      if (directoryId) {
        params.set('directoryId', directoryId);
      }
      navigate(`/slides/create?${params.toString()}`);
    },
    [navigate, document?.directoryId]
  );

  const handleTocGenerated = useCallback(
    (toc: TocItem[]) => {
      dispatch(setTocItems(toc));
    },
    [dispatch]
  );

  const handleExportPDF = useCallback(async () => {
    if (!contentRef.current || !document) return;

    dispatch(setIsExporting(true));
    try {
      await exportToPDF(contentRef.current, {
        filename: `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
        title: document.title,
        quality: 1,
        scale: 2,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      dispatch(setIsExporting(false));
    }
  }, [contentRef, document, dispatch]);

  const handleToggleToc = useCallback(() => {
    dispatch(toggleToc());
  }, [dispatch]);

  const handleTocItemClick = useCallback((id: string) => {
    const element = window.document.getElementById(id);
    if (element) {
      const headerHeight = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      element.style.transition = 'background-color 0.3s ease';
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 1000);
    }
  }, []);

  const handleDownloadMd = useCallback(() => {
    if (!content || !document) return;
    downloadMarkdownFile(content, document.title);
  }, [content, document]);

  const handleAskDocumentQuestion = useCallback(
    async (question: string) => {
      if (!document) return;

      dispatch(setQuestionAsking(true));

      try {
        const result = await askDocumentQuestion({
          documentId: document.id,
          question,
        }).unwrap();

        if (result.success && result.data?.content) {
          dispatch(setQuestionAnswer(result.data.content));
        } else {
          dispatch(setQuestionError('Failed to generate answer'));
        }
      } catch (error) {
        const errorMessage =
          (error as { data?: { message?: string } })?.data?.message ||
          'Failed to generate answer';
        dispatch(setQuestionError(errorMessage));
      }
    },
    [dispatch, askDocumentQuestion, document]
  );

  const handleReviseWithAI = useCallback(
    async (instruction: string) => {
      if (!document || !content) return;

      if (content.length > AI_REVISION_EXISTING_CONTENT_MAX) {
        dispatch(
          setEditError(
            `Document content must be ${AI_REVISION_EXISTING_CONTENT_MAX.toLocaleString()} characters or less.`
          )
        );
        dispatch(setEditAiState('error'));
        return;
      }

      dispatch(setEditAiState('generating'));
      dispatch(setEditError(null));

      try {
        const result = await reviseDocumentWithAI({
          documentId: document.id,
          instruction,
        }).unwrap();

        dispatch(setEditPreviewContent(result.content));
        dispatch(setEditAiState('done'));
      } catch (error) {
        const errorMessage =
          (error as { data?: { message?: string } })?.data?.message ||
          'Failed to revise document with AI.';
        dispatch(setEditError(errorMessage));
        dispatch(setEditAiState('error'));
      }
    },
    [content, dispatch, document, reviseDocumentWithAI]
  );

  const handleApplyRevision = useCallback(async () => {
    if (!document || !editPreviewContent) return;

    dispatch(setIsApplyingRevision(true));

    try {
      await updateDocument({
        documentId: document.id,
        content: editPreviewContent,
      }).unwrap();

      dispatch(resetEditPanelState());
      showToast('Document updated successfully', 'success');
    } catch (error) {
      const errorMessage =
        (error as { data?: { message?: string } })?.data?.message ||
        'Failed to save revised document.';
      showToast(errorMessage, 'error');
    } finally {
      dispatch(setIsApplyingRevision(false));
    }
  }, [dispatch, document, editPreviewContent, showToast, updateDocument]);

  const handleDiscardRevision = useCallback(() => {
    dispatch(resetEditPreview());
  }, [dispatch]);

  return {
    handleCreateQuizFromDocument,
    handleGenerateFlashcards,
    handleGenerateSlideDeck,
    handleTocGenerated,
    handleExportPDF,
    handleDownloadMd,
    handleToggleToc,
    handleTocItemClick,
    handleAskDocumentQuestion,
    handleReviseWithAI,
    handleApplyRevision,
    handleDiscardRevision,
    isExporting,
  };
};
