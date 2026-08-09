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

  return {
    handleTocGenerated,
    handleExportPDF,
    handleDownloadMd,
    handleToggleToc,
    handleTocItemClick,
    isExporting,
  };
};
