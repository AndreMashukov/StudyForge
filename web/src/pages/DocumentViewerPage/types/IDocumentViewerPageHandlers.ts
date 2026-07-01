import { TocItem } from '../../../components/MarkdownRenderer';

export interface IDocumentViewerPageHandlers {
  handleCreateQuizFromDocument: (docId: string) => void;
  handleTocGenerated: (toc: TocItem[]) => void;
  handleExportPDF: () => Promise<void>;
  handleDownloadMd: () => void;
  handleToggleToc: () => void;
  handleTocItemClick: (id: string) => void;
  handleAskDocumentQuestion: (question: string) => void;
  handleReviseWithAI: (instruction: string) => void;
  handleApplyRevision: () => Promise<void>;
  handleDiscardRevision: () => void;
  isExporting: boolean;
}
