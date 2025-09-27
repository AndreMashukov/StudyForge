import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { TocItem, exportToPDF } from '../../../../components/MarkdownRenderer';
import { DocumentEnhanced } from "@shared-types";
import { 
  setTocItems, 
  setShowToc,
  toggleToc, 
  setIsExporting,
  selectIsExporting 
} from '../../../../store/slices/documentViewerPageSlice';

interface UseDocumentViewerPageHandlersProps {
  document: DocumentEnhanced | undefined;
  contentRef: React.RefObject<HTMLDivElement | null>;
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
    // Automatically show TOC if it has items and isn't already shown
    if (toc.length > 0) {
      // Only auto-show if there are multiple headings to make TOC useful
      if (toc.length >= 2) {
        dispatch(setShowToc(true));
      }
    }
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
      // Calculate offset to account for sticky header
      const headerHeight = 80; // Approximate height of sticky header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Add a subtle highlight effect
      element.style.transition = 'background-color 0.3s ease';
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 1000);
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