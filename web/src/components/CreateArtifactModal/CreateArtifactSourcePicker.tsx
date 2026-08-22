import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Search, X } from 'lucide-react';
import { DocumentEnhanced } from '@shared-types';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';

const MAX_SOURCE_SELECTIONS = 5;

export interface ICreateArtifactSourcePicker {
  documents: DocumentEnhanced[];
  selectedDocumentIds: string[];
  onSelectionChange: (documentIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

function SourcePickerContent({
  documents,
  draftSelectedIds,
  onToggle,
  onSelectAll,
  onClear,
  searchQuery,
  onSearchChange,
  maxSelections,
}: {
  documents: DocumentEnhanced[];
  draftSelectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  maxSelections: number;
}) {
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return documents;
    }
    return documents.filter((document) =>
      document.title.toLowerCase().includes(normalizedQuery),
    );
  }, [documents, searchQuery]);

  const draftCount = draftSelectedIds.length;
  const allSelected =
    documents.length > 0 && draftCount === Math.min(documents.length, maxSelections);
  const canSelectMore = draftCount < maxSelections;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Source documents</p>
        <p className="text-xs text-muted-foreground">
          Choose up to {maxSelections} documents for generation.
        </p>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search sources..."
          className="h-8 pl-8 text-sm"
          aria-label="Search source documents"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onSelectAll}
          disabled={allSelected || documents.length === 0}
        >
          Select all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onClear}
          disabled={draftCount === 0}
        >
          Clear
        </Button>
      </div>

      <div
        className="max-h-48 space-y-1 overflow-y-auto pr-1"
        role="listbox"
        aria-label="Source documents"
        aria-multiselectable="true"
      >
        {filteredDocuments.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No matching sources.</p>
        ) : (
          filteredDocuments.map((document) => {
            const isSelected = draftSelectedIds.includes(document.id);
            const isDisabled = !isSelected && !canSelectMore;
            return (
              <div
                key={document.id}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : 0}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!isDisabled) {
                    onToggle(document.id, !isSelected);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== ' ' && event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  if (!isDisabled) {
                    onToggle(document.id, !isSelected);
                  }
                }}
                className={cn(
                  'flex w-full items-center rounded-md px-1 py-1 text-left hover:bg-muted/40',
                  isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isDisabled}
                  label={document.title}
                  className="pointer-events-none"
                />
              </div>
            );
          })
        )}
      </div>

      {draftCount === 0 ? (
        <p className="text-xs text-destructive">Select at least one source to generate.</p>
      ) : null}

      {!canSelectMore ? (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxSelections} sources selected.
        </p>
      ) : null}
    </div>
  );
}

export const CreateArtifactSourcePicker: React.FC<ICreateArtifactSourcePicker> = ({
  documents,
  selectedDocumentIds,
  onSelectionChange,
  isLoading = false,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(selectedDocumentIds);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDraftSelectedIds(selectedDocumentIds);
    }
  }, [open, selectedDocumentIds]);

  const selectedCount = selectedDocumentIds.length;
  const totalSourceCount = documents.length;

  const handleToggle = useCallback((sourceId: string, checked: boolean) => {
    setDraftSelectedIds((current) => {
      if (checked) {
        if (current.includes(sourceId) || current.length >= MAX_SOURCE_SELECTIONS) {
          return current;
        }
        return [...current, sourceId];
      }
      return current.filter((id) => id !== sourceId);
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setDraftSelectedIds(documents.slice(0, MAX_SOURCE_SELECTIONS).map((document) => document.id));
  }, [documents]);

  const handleClear = useCallback(() => {
    setDraftSelectedIds([]);
  }, []);

  const handleApply = useCallback(() => {
    if (draftSelectedIds.length === 0) {
      return;
    }
    onSelectionChange(draftSelectedIds);
    setOpen(false);
  }, [draftSelectedIds, onSelectionChange]);

  const sourceLabel =
    totalSourceCount === 0
      ? 'No sources'
      : `${selectedCount}/${totalSourceCount} ${
          totalSourceCount === 1 ? 'source' : 'sources'
        }`;

  const pickerContent = (
    <SourcePickerContent
      documents={documents}
      draftSelectedIds={draftSelectedIds}
      onToggle={handleToggle}
      onSelectAll={handleSelectAll}
      onClear={handleClear}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      maxSelections={MAX_SOURCE_SELECTIONS}
    />
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          disabled={disabled || totalSourceCount === 0 || isLoading}
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex max-w-full items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          aria-label="Manage source documents"
        >
          {isLoading ? <Spinner size="xs" className="mr-1" /> : null}
          <span className="truncate">{sourceLabel}</span>
        </button>

        {open ? (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-2xl border border-border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-base font-semibold">Source documents</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 hover:bg-accent"
                  aria-label="Close source picker"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto p-4">{pickerContent}</div>
              <div className="border-t p-4">
                <Button
                  type="button"
                  className="w-full"
                  disabled={draftSelectedIds.length === 0}
                  onClick={handleApply}
                >
                  Apply
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled || totalSourceCount === 0 || isLoading}>
        <button
          type="button"
          className={cn(
            'inline-flex max-w-full items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          aria-label="Manage source documents"
        >
          {isLoading ? <Spinner size="xs" className="mr-1" /> : null}
          <span className="truncate">{sourceLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-[70] w-80 rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          {pickerContent}
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              disabled={draftSelectedIds.length === 0}
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
