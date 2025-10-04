/**
 * DocumentSelector Component
 * Displays a scrollable list of user documents with checkboxes for selection
 */

import React from 'react';
import { BookOpen, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '../../../../../components/ui/Button';
import { IDocumentSelector } from './IDocumentSelector';
import { documentSelectorStyles } from './DocumentSelector.styles';
import { cn } from '../../../../../lib/utils';
import { formatDate } from '../../../../../utils/dateUtils';

export const DocumentSelector = ({
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  canSelectMore,
  isLoading,
  disabled = false,
}: IDocumentSelector) => {
  // Loading state
  if (isLoading) {
    return (
      <div className={documentSelectorStyles.container}>
        <div className={documentSelectorStyles.loadingContainer}>
          <div className={documentSelectorStyles.loadingSpinner} />
          <p className={documentSelectorStyles.loadingText}>
            Loading your documents...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <div className={documentSelectorStyles.container}>
        <div className={documentSelectorStyles.emptyContainer}>
          <BookOpen className={documentSelectorStyles.emptyIcon} />
          <div>
            <h3 className={documentSelectorStyles.emptyTitle}>
              No documents in your library yet
            </h3>
            <p className={documentSelectorStyles.emptyDescription}>
              Create some documents first to use them as context for generating new content.
              You can create documents from URLs, uploaded files, or AI-generated content.
            </p>
          </div>
          <div className={documentSelectorStyles.emptyAction}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/documents'}
            >
              Go to Documents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Document list
  return (
    <div className={documentSelectorStyles.container}>
      <div className={documentSelectorStyles.scrollContainer}>
        {documents.map(document => {
          const isSelected = selectedDocumentIds.includes(document.id);
          const isDisabled = disabled || (!canSelectMore && !isSelected);
          const isLarge = document.wordCount > 25000;
          const isVeryLarge = document.wordCount > 50000;

          return (
            <label
              key={document.id}
              className={cn(
                documentSelectorStyles.documentItem,
                isSelected && documentSelectorStyles.documentItemSelected,
                isDisabled && documentSelectorStyles.documentItemDisabled
              )}
              aria-label={`Select ${document.title}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  if (!isDisabled) {
                    onDocumentToggle(document.id);
                  }
                }}
                disabled={isDisabled}
                className={documentSelectorStyles.checkbox}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${document.title}`}
                title={isDisabled && !isSelected ? 'Maximum of 5 items reached' : undefined}
              />
              
              <div className={documentSelectorStyles.documentContent}>
                <h4 className={documentSelectorStyles.documentTitle}>
                  {document.title}
                </h4>
                
                <div className={documentSelectorStyles.documentMeta}>
                  <div className={documentSelectorStyles.documentMetaItem}>
                    <FileText className={documentSelectorStyles.documentMetaIcon} />
                    <span>{document.wordCount.toLocaleString()} words</span>
                  </div>
                  
                  <div className={documentSelectorStyles.documentMetaDivider} />
                  
                  <div className={documentSelectorStyles.documentMetaItem}>
                    <Calendar className={documentSelectorStyles.documentMetaIcon} />
                    <span>{formatDate(document.createdAt)}</span>
                  </div>
                </div>
                
                {/* Warning for large documents */}
                {isLarge && !isVeryLarge && (
                  <div className={cn(documentSelectorStyles.warningBadge, 'mt-2')}>
                    <AlertTriangle className={documentSelectorStyles.warningIcon} />
                    <span>Large document - monitor context size</span>
                  </div>
                )}
                
                {isVeryLarge && (
                  <div className={cn(documentSelectorStyles.warningBadge, 'mt-2', 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20')}>
                    <AlertTriangle className={documentSelectorStyles.warningIcon} />
                    <span>Very large document - may exceed limits</span>
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
      
      {!canSelectMore && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Maximum of 5 items reached. Remove some files to add more documents.
          </p>
        </div>
      )}
      
      {documents.length > 10 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing {documents.length} documents. Use search to find specific documents.
        </p>
      )}
    </div>
  );
};

