import React, { useCallback, useEffect, useRef } from 'react';
import { BookOpen, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { DocumentEnhanced } from '@shared-types';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { VirtualizedList, type IVirtualizedListHandle } from '../VirtualizedList';
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
  hasMore = false,
  isLoadingMore = false,
  loadMore,
  loadError = null,
  onRetryLoad,
}: IDocumentSelector) => {
  const isSingleSelect = maxSelections === 1;
  const hasScrolledRef = useRef(false);
  const listRef = useRef<IVirtualizedListHandle>(null);

  useEffect(() => {
    if (hasScrolledRef.current || selectedDocumentIds.length === 0 || documents.length === 0) {
      return;
    }

    const selectedId = selectedDocumentIds[0];
    const selectedIndex = documents.findIndex((doc) => doc.id === selectedId);
    if (selectedIndex < 0) {
      return;
    }

    listRef.current?.scrollToIndex(selectedIndex, { align: 'center' });
    hasScrolledRef.current = true;
  }, [selectedDocumentIds, documents]);

  const effectiveCanSelectMore =
    canSelectMoreProp !== undefined
      ? canSelectMoreProp
      : maxSelections !== undefined
        ? selectedDocumentIds.length < maxSelections
        : true;

  const renderDocument = useCallback(
    (document: DocumentEnhanced) => {
      const isSelected = selectedDocumentIds.includes(document.id);
      const isItemDisabled = disabled || (!isSingleSelect && !effectiveCanSelectMore && !isSelected);
      const isLarge = document.wordCount > 25000;
      const isVeryLarge = document.wordCount > 50000;

      return (
        <div
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

                {isLarge && !isVeryLarge ? (
                  <div className={cn(documentSelectorStyles.warningBadge, 'mt-2')}>
                    <AlertTriangle className={documentSelectorStyles.warningIcon} />
                    <span>Large document - monitor context size</span>
                  </div>
                ) : null}

                {isVeryLarge ? (
                  <div
                    className={cn(
                      documentSelectorStyles.warningBadge,
                      'mt-2',
                      'bg-destructive/10 text-destructive border-destructive/20',
                    )}
                  >
                    <AlertTriangle className={documentSelectorStyles.warningIcon} />
                    <span>Very large document - may exceed limits</span>
                  </div>
                ) : null}
              </div>
            }
          />
        </div>
      );
    },
    [
      disabled,
      effectiveCanSelectMore,
      isSingleSelect,
      maxSelections,
      onDocumentToggle,
      selectedDocumentIds,
    ],
  );

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
      <VirtualizedList
        ref={listRef}
        items={documents}
        scrollMode="container"
        containerClassName={documentSelectorStyles.scrollContainer}
        estimateSize={96}
        gap={8}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loadMore={loadMore}
        loadError={loadError}
        onRetryLoad={onRetryLoad}
        renderItem={renderDocument}
      />

      {!isSingleSelect && !effectiveCanSelectMore ? (
        <div className="mt-3 p-2 bg-accent/10 border border-accent/20 rounded-md">
          <p className="text-xs text-accent text-center">
            Maximum of {maxSelections ?? 5} items reached. Remove some files to add more documents.
          </p>
        </div>
      ) : null}

      {documents.length > 10 ? (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing {documents.length} loaded documents{hasMore ? ' — scroll for more' : ''}.
        </p>
      ) : null}
    </div>
  );
};
