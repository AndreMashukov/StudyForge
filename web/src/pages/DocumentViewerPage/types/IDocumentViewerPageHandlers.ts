import { TocItem } from '../../../components/MarkdownRenderer';

export interface IDocumentViewerPageHandlers {
  handleCreateQuizFromDocument: (docId: string) => void;
  handleTocGenerated: (toc: TocItem[]) => void;
  handleExportPDF: () => Promise<void>;
  handleToggleToc: () => void;
  handleTocItemClick: (id: string) => void;
  isExporting: boolean;
}