import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TocItem, exportToPDF } from '../../../../components/MarkdownRenderer';
import { downloadMarkdownFile } from '../../../../utils/downloadUtils';
import { DocumentEnhanced } from '@shared-types';
import {
  useClearScratchPadAvoidedQuestionsMutation,
  useEvaluateScratchPadAnswerMutation,
  useRegenerateScratchPadQuestionMutation,
} from '../../../../store/api/ScratchPad/scratchPadApi';
import {
  setTocItems,
  toggleToc,
  setIsExporting,
  selectIsExporting,
} from '../../../../store/slices/documentViewerPageSlice';

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
  const [regenerateScratchPadQuestion] = useRegenerateScratchPadQuestionMutation();
  const [clearScratchPadAvoidedQuestions] =
    useClearScratchPadAvoidedQuestionsMutation();
  const [evaluateScratchPadAnswer] = useEvaluateScratchPadAnswerMutation();

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

  const handleRegenerateScratchPad = useCallback(
    async (sectionIndex: number) => {
      if (!document?.id) {
        throw new Error('Document not loaded');
      }
      const response = await regenerateScratchPadQuestion({
        documentId: document.id,
        sectionIndex,
        ruleIds: document.appliedRuleIds,
      }).unwrap();
      if (!response.success) {
        throw new Error('Regeneration failed');
      }
    },
    [document, regenerateScratchPadQuestion],
  );

  const handleClearScratchPadMemory = useCallback(
    async (sectionIndex: number) => {
      if (!document?.id) {
        throw new Error('Document not loaded');
      }
      const response = await clearScratchPadAvoidedQuestions({
        documentId: document.id,
        sectionIndex,
      }).unwrap();
      if (!response.success) {
        throw new Error('Clear memory failed');
      }
    },
    [clearScratchPadAvoidedQuestions, document],
  );

  const handleEvaluateScratchPad = useCallback(
    async (sectionIndex: number, userAnswer: string) => {
      if (!document?.id) {
        throw new Error('Document not loaded');
      }
      const response = await evaluateScratchPadAnswer({
        documentId: document.id,
        sectionIndex,
        userAnswer,
        ruleIds: document.appliedRuleIds,
      }).unwrap();
      if (!response.success || !response.data) {
        throw new Error('Evaluation failed');
      }
      return {
        score: response.data.score,
        hint: response.data.hint,
      };
    },
    [document, evaluateScratchPadAnswer],
  );

  return {
    handleTocGenerated,
    handleExportPDF,
    handleDownloadMd,
    handleToggleToc,
    handleTocItemClick,
    handleRegenerateScratchPad,
    handleClearScratchPadMemory,
    handleEvaluateScratchPad,
    isExporting,
  };
};
