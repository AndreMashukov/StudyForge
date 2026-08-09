import { DocumentContentFormat, DocumentEnhanced } from '@shared-types';
import { TocItem } from '../../../components/MarkdownRenderer';

export interface IDocumentViewerPageContext {
  documentApi: {
    data?: DocumentEnhanced;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  contentApi: {
    data?: { content: string; contentFormat: DocumentContentFormat };
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  handlers: {
    handleTocGenerated: (toc: TocItem[]) => void;
    handleExportPDF: () => Promise<void>;
    handleDownloadMd: () => void;
    handleToggleToc: () => void;
    handleTocItemClick: (id: string) => void;
    isExporting: boolean;
  };
  contentRef: React.RefObject<HTMLDivElement | null>;
}
