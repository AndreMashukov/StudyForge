import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { TocItem, exportToPDF } from '../../../../components/MarkdownRenderer';
import { DocumentEnhanced } from "@shared-types";
import { 
  setTocItems, 
  toggleToc, 
  setIsExporting,
  selectIsExporting 
} from '../../../../store/slices/documentViewerPageSlice';

interface UseDocumentViewerPageHandlersProps {
  document: DocumentEnhanced | undefined;
  contentRef: React.RefObject<HTMLDivElement>;
}

export const useDocumentViewerPageHandlers = ({ 
  document, 
  contentRef 
}: UseDocumentViewerPageHandlersProps) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isExporting = useSelector(selectIsExporting);

  const handleCreateQuizFromDocument = useCallback((docId: string) => {
    navigate(`/quiz/create?documentId=${docId}`);
  }, [navigate]);

  const handleTocGenerated = useCallback((toc: TocItem[]) => {
    dispatch(setTocItems(toc));
  }, [dispatch]);

  const handleExportPDF = useCallback(async () => {
    if (!contentRef.current || !document) return;
    
    dispatch(setIsExporting(true));
    try {
      await exportToPDF(contentRef.current, {
        filename: `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
        title: document.title,
        quality: 1,
        scale: 2
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      // TODO: Add toast notification for error
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
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return {
    handleCreateQuizFromDocument,
    handleTocGenerated,
    handleExportPDF,
    handleToggleToc,
    handleTocItemClick,
    isExporting,
  };
};