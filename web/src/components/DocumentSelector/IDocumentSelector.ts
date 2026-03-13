import { DocumentEnhanced } from '@shared-types';

export interface IDocumentSelector {
  documents: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onDocumentToggle: (documentId: string) => void;
  /**
   * Maximum number of documents that can be selected.
   * When set to 1, behaves as single-select (no "maximum reached" warning shown).
   * When omitted, selection is unlimited (unless canSelectMore is provided).
   */
  maxSelections?: number;
  /**
   * Explicit external override for whether more documents can be selected.
   * Takes precedence over the maxSelections-derived value.
   * Used when the selectable limit is shared with other attachment types (e.g. uploaded files).
   */
  canSelectMore?: boolean;
  isLoading: boolean;
  disabled?: boolean;
  className?: string;
}
