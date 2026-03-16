import React, { useState } from 'react';
import { FileText, X, Plus, BookMarked, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { DocumentSelector } from '../DocumentSelector';
import { IPreSelectedDocumentSelector } from './IPreSelectedDocumentSelector';
import { preSelectedDocumentSelectorStyles as styles } from './PreSelectedDocumentSelector.styles';
import { cn } from '../../lib/utils';

export const PreSelectedDocumentSelector = ({
  documents,
  selectedDocumentIds,
  onDocumentToggle,
  maxSelections,
  isLoading,
  disabled = false,
  className,
  initialDocumentId,
}: IPreSelectedDocumentSelector) => {
  const [showPicker, setShowPicker] = useState(false);

  const canAddMore =
    !disabled &&
    (maxSelections === undefined || selectedDocumentIds.length < maxSelections);

  // Documents available to add (exclude already selected)
  const availableDocuments = documents.filter(
    (d) => !selectedDocumentIds.includes(d.id)
  );

  // Loading state — no docs selected yet
  if (isLoading && selectedDocumentIds.length === 0) {
    return (
      <div className={cn('space-y-1', className)}>
        <div className={styles.loadingCard}>
          <Loader2 size={20} className="text-primary animate-spin flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded w-1/3" />
          </div>
        </div>
        <p className={styles.helperText}>Auto-selected from your current session</p>
      </div>
    );
  }

  // No pre-selection and no selections — show plain document selector
  if (!initialDocumentId && selectedDocumentIds.length === 0) {
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

  const handlePickerToggle = (id: string) => {
    onDocumentToggle(id);
    // Close picker after selecting
    setShowPicker(false);
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Stacked selected document cards */}
      {selectedDocumentIds.map((id) => {
        const doc = documents.find((d) => d.id === id);
        const isInitial = id === initialDocumentId;

        return (
          <div key={id} className={styles.card}>
            <FileText size={20} className={styles.cardIcon} />

            <div className={styles.cardInfo}>
              <div className={styles.cardTitle}>{doc?.title ?? id}</div>
              {doc?.wordCount != null && (
                <div className={styles.cardMeta}>
                  {doc.wordCount.toLocaleString()} words
                </div>
              )}
              {isInitial && (
                <div className={styles.cardBadge}>
                  <BookMarked size={11} />
                  Current document
                </div>
              )}
            </div>

            {/* × remove button */}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={styles.removeBtn}
                onClick={() => {
                  onDocumentToggle(id);
                  setShowPicker(false);
                }}
                aria-label={`Remove ${doc?.title ?? id}`}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        );
      })}

      {/* + Add more documents button */}
      {canAddMore && availableDocuments.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={styles.addMoreBtn}
          onClick={() => setShowPicker((v) => !v)}
          disabled={disabled || isLoading}
        >
          <Plus size={14} />
          {showPicker ? 'Close document picker' : '+ Add more documents'}
        </Button>
      )}

      {/* Helper text */}
      {initialDocumentId && !showPicker && (
        <p className={styles.helperText}>Auto-selected from your current session</p>
      )}

      {/* Expanded document picker */}
      {showPicker && (
        <div className={styles.pickerPanel}>
          <p className={styles.pickerLabel}>Select additional documents:</p>
          <DocumentSelector
            documents={availableDocuments}
            selectedDocumentIds={[]}
            onDocumentToggle={handlePickerToggle}
            maxSelections={maxSelections !== undefined ? maxSelections - selectedDocumentIds.length : undefined}
            isLoading={isLoading}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};
