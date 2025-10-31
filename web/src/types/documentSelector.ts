/**
 * Document Selector Type Definitions
 * Types for selecting existing documents from library as context
 */

import { DocumentEnhanced } from '@shared-types';

// Document Selector Item (UI representation)
export interface IDocumentSelectorItem {
  id: string;
  title: string;
  wordCount: number;
  isSelected: boolean;
}

// Document Selection State
export interface IDocumentSelectionState {
  selectedDocumentIds: string[];
  isLoading: boolean;
  error: string | null;
}

// Convert DocumentEnhanced to DocumentSelectorItem
export function toDocumentSelectorItem(
  document: DocumentEnhanced,
  isSelected: boolean
): IDocumentSelectorItem {
  return {
    id: document.id,
    title: document.title,
    wordCount: document.wordCount,
    isSelected,
  };
}

// Type guard for DocumentEnhanced
export function isDocumentEnhanced(obj: unknown): obj is DocumentEnhanced {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as DocumentEnhanced).id === 'string' &&
    typeof (obj as DocumentEnhanced).title === 'string' &&
    typeof (obj as DocumentEnhanced).wordCount === 'number'
  );
}

