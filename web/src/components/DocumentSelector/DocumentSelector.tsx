import React, { useEffect, useRef } from 'react';
import { BookOpen, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { IDocumentSelector } from './IDocumentSelector';
import { documentSelectorStyles } from './DocumentSelector.styles';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/dateUtils';

export const DocumentSelector = ({
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  maxSelections,
  canSelectMore: canSelectMoreProp,
  isLoading,
  disabled = false,
  className,
}: IDocumentSelector) => {
  const isSingleSelect = maxSelections === 1;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current || selectedDocumentIds.length === 0 || documents.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedId = selectedDocumentIds[0];
    const selectedElement = container.querySelector(`[data-document-id="${selectedId}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'center' });
      hasScrolledRef.current = true;
    }
  }, [selectedDocumentIds, documents]);

  // Determine whether additional items can be selected.
  // An explicit canSelectMore prop always takes precedence (e.g. when the
  // limit is shared with uploaded files). Otherwise derive from maxSelections.
  const effectiveCanSelectMore =
    canSelectMoreProp !== undefined
      ? canSelectMoreProp
      : maxSelections !== undefined
        ? selectedDocumentIds.length < maxSelections
        : true;

  if (isLoading) {
    return (
      <div className={cn(documentSelectorStyles.container, className)}>
        <div className={documentSelectorStyles.loadingContainer}>
          <div className={documentSelectorStyles.loadingSpinner} />
          <p className={documentSelectorStyles.loadingText}>Loading your documents...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={cn(documentSelectorStyles.container, className)}>
        <div className={documentSelectorStyles.emptyContainer}>
          <BookOpen className={documentSelectorStyles.emptyIcon} />
          <div>
            <h3 className={documentSelectorStyles.emptyTitle}>No documents in your library yet</h3>
            <p className={documentSelectorStyles.emptyDescription}>
              Create some documents first to use them as context for generating new content. You can
              create documents from URLs, uploaded files, or AI-generated content.
            </p>
          </div>
          <div className={documentSelectorStyles.emptyAction}>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/documents')}>
              Go to Documents
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(documentSelectorStyles.container, className)}>
      <div ref={scrollContainerRef} className={documentSelectorStyles.scrollContainer}>
        {documents.map((document) => {
          const isSelected = selectedDocumentIds.includes(document.id);
          // For single-select, never lock out unselected items — toggling replaces the selection.
          const isItemDisabled = disabled || (!isSingleSelect && !effectiveCanSelectMore && !isSelected);
          const isLarge = document.wordCount > 25000;
          const isVeryLarge = document.wordCount > 50000;

          return (
            <div
              key={document.id}
              data-document-id={document.id}
              title={
                isItemDisabled && !isSelected
                  ? `Maximum of ${maxSelections ?? 5} items reached`
                  : undefined
              }
            >
              <Checkbox
                checked={isSelected}
                onChange={() => {
                  if (!isItemDisabled) {
                    onDocumentToggle(document.id);
                  }
                }}
                disabled={isItemDisabled}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${document.title}`}
                className={cn(
                  documentSelectorStyles.documentItem,
                  isSelected && documentSelectorStyles.documentItemSelected,
                  isItemDisabled && documentSelectorStyles.documentItemDisabled,
                )}
                label={
                  <div className={documentSelectorStyles.documentContent}>
                    <h4 className={documentSelectorStyles.documentTitle}>{document.title}</h4>

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

                    {isLarge && !isVeryLarge && (
                      <div className={cn(documentSelectorStyles.warningBadge, 'mt-2')}>
                        <AlertTriangle className={documentSelectorStyles.warningIcon} />
                        <span>Large document - monitor context size</span>
                      </div>
                    )}

                    {isVeryLarge && (
                      <div
                        className={cn(
                          documentSelectorStyles.warningBadge,
                          'mt-2',
                          'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                        )}
                      >
                        <AlertTriangle className={documentSelectorStyles.warningIcon} />
                        <span>Very large document - may exceed limits</span>
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          );
        })}
      </div>

      {!isSingleSelect && !effectiveCanSelectMore && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            Maximum of {maxSelections ?? 5} items reached. Remove some files to add more documents.
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
