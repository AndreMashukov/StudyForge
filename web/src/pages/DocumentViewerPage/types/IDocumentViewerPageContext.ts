import { DocumentEnhanced } from "@shared-types";
import { TocItem } from '../../../components/MarkdownRenderer';

export interface IDocumentViewerPageContext {
  documentApi: {
    data?: DocumentEnhanced;
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  contentApi: {
    data?: { content: string };
    isLoading: boolean;
    error?: unknown;
    refetch: () => void;
  };
  handlers: {
    handleCreateQuizFromDocument: (docId: string) => void;
    handleTocGenerated: (toc: TocItem[]) => void;
    handleExportPDF: () => Promise<void>;
    handleToggleToc: () => void;
    handleTocItemClick: (id: string) => void;
    isExporting: boolean;
  };
  contentRef: React.RefObject<HTMLDivElement | null>;
  // DON'T include: tocItems, showToc (access through Redux selectors)
}