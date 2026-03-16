import { DocumentEnhanced } from '@shared-types';

export interface IPreSelectedDocumentSelector {
  documents: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onDocumentToggle: (documentId: string) => void;
  maxSelections?: number;
  isLoading: boolean;
  disabled?: boolean;
  className?: string;
  /** The documentId pre-selected from URL params (current document) */
  initialDocumentId?: string;
}
