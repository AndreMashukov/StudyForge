import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TocItem, exportToPDF } from '../../../../components/MarkdownRenderer';
import { downloadMarkdownFile } from '../../../../utils/downloadUtils';
import { DocumentEnhanced } from '@shared-types';
import {
  setTocItems,
  toggleToc,
  setIsExporting,
  selectIsExporting,
  setQuestionAsking,
  setQuestionAnswer,
  setQuestionError,
} from '../../../../store/slices/documentViewerPageSlice';
import { useAskDocumentQuestionMutation } from '../../../../store/api/DocumentQuestion/DocumentQuestionApi';

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
  const dispatch = useDispatch();
  const isExporting = useSelector(selectIsExporting);
  const [askDocumentQuestion] = useAskDocumentQuestionMutation();

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

  return {
    handleTocGenerated,
    handleExportPDF,
    handleDownloadMd,
    handleToggleToc,
    handleTocItemClick,
    handleAskDocumentQuestion,
    isExporting,
  };
};
