/**
 * DocumentSelector Component Interface
 * Allows selecting existing documents from library as context
 */

import { DocumentEnhanced } from '@shared-types';

export interface IDocumentSelector {
  documents: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onDocumentToggle: (documentId: string) => void;
  canSelectMore: boolean;
  isLoading: boolean;
  disabled?: boolean;
}

