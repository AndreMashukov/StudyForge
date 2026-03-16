import React, { useState } from 'react';
import { FileText, ChevronDown, X, BookMarked, Loader2 } from 'lucide-react';
import { DocumentSelector } from '../DocumentSelector';
import { IPreSelectedDocumentSelector } from './IPreSelectedDocumentSelector';
import { preSelectedDocumentSelectorStyles as styles } from './PreSelectedDocumentSelector.styles';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export const PreSelectedDocumentSelector = ({
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  maxSelections,
  isLoading,
  disabled,
  className,
  initialDocumentId,
}: IPreSelectedDocumentSelector) => {
  const [isExpanded, setIsExpanded] = useState(!initialDocumentId);

  // No pre-selection requested — render plain document selector
  if (!initialDocumentId) {
    return (
      <DocumentSelector
        documents={documents}
        selectedDocumentIds={selectedDocumentIds}
        onDocumentToggle={onDocumentToggle}
        maxSelections={maxSelections}
        isLoading={isLoading}
        disabled={disabled}
        className={className}
      />
    );
  }

  // Documents are still loading — show a skeleton card
  if (isLoading) {
    return (
      <div className={cn('space-y-0', className)}>
        <div className={cn(styles.card, 'animate-pulse')}>
          <Loader2 size={20} className="text-primary animate-spin flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded w-1/3" />
            <div className="h-2 bg-muted rounded w-1/2" />
          </div>
        </div>
        <p className={styles.helperText}>Loading document...</p>
      </div>
    );
  }

  // Use initialDocumentId directly to find the pre-selected document
  const preSelectedDoc = documents.find((d) => d.id === initialDocumentId);

  // Fix: only use currentSelectedDoc when selectedDocumentIds is non-empty
  // to prevent empty-selection drift when user deselects
  const currentSelectedId = selectedDocumentIds.length > 0 ? selectedDocumentIds[0] : undefined;
  const currentSelectedDoc = currentSelectedId
    ? documents.find((d) => d.id === currentSelectedId)
    : undefined;

  // The document to display in the card
  const displayDoc = currentSelectedDoc || preSelectedDoc;

  // Documents loaded but initialDocumentId not found — fall back to plain list
  if (!displayDoc) {
    return (
      <DocumentSelector
        documents={documents}
        selectedDocumentIds={selectedDocumentIds}
        onDocumentToggle={onDocumentToggle}
        maxSelections={maxSelections}
        isLoading={isLoading}
        disabled={disabled}
        className={className}
      />
    );
  }

  const isCurrentDocument = displayDoc.id === initialDocumentId;

  return (
    <div className={cn('space-y-0', className)}>
      {/* Pre-selected card */}
      <div className={styles.card}>
        <FileText size={20} className={styles.cardIcon} />
        <div className={styles.cardInfo}>
          <div className={styles.cardTitle}>{displayDoc.title}</div>
          <div className={styles.cardMeta}>
            {displayDoc.wordCount?.toLocaleString()} words
          </div>
          {isCurrentDocument && (
            <div className={styles.cardBadge}>
              <BookMarked size={11} />
              Current document
            </div>
          )}
        </div>
        {/* Fix: use shadcn Button instead of native <button> */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.changeBtn}
          onClick={() => setIsExpanded((v) => !v)}
          disabled={disabled || isLoading}
        >
          {isExpanded ? (
            <><X size={12} /> Cancel</>
          ) : (
            <><ChevronDown size={12} /> Change</>
          )}
        </Button>
      </div>

      {!isExpanded && (
        <p className={styles.helperText}>Auto-selected from your current session</p>
      )}

      {isExpanded && (
        <div>
          <div className={styles.divider} />
          <p className={styles.expandedLabel}>Select a different document:</p>
          <DocumentSelector
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            onDocumentToggle={(id) => {
              onDocumentToggle(id);
              if (id !== currentSelectedId) setIsExpanded(false);
            }}
            maxSelections={maxSelections}
            isLoading={isLoading}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};
