import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DirectoryChatSourceSummary } from '@shared-types';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { useUpdateDirectoryChatSourcesMutation } from '../../store/api/DirectoryChat';

export interface IDirectoryChatSourceSelector {
  directoryId: string;
  sources: DirectoryChatSourceSummary[];
  selectedDocumentIds: string[];
  totalSourceCount: number;
  disabled?: boolean;
  className?: string;
}

const arraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const DirectoryChatSourceSelector: React.FC<IDirectoryChatSourceSelector> = ({
  directoryId,
  sources,
  selectedDocumentIds,
  totalSourceCount,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>(selectedDocumentIds);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [updateDirectoryChatSources, { isLoading: isSaving }] =
    useUpdateDirectoryChatSourcesMutation();

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSaveError(null);
      setDraftSelectedIds(selectedDocumentIds);
    }
  }, [open, selectedDocumentIds]);

  const filteredSources = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return sources;
    }

    return sources.filter((source) =>
      source.title.toLowerCase().includes(normalizedQuery),
    );
  }, [searchQuery, sources]);

  const selectedCount = selectedDocumentIds.length;
  const draftSelectedCount = draftSelectedIds.length;
  const hasDraftChanges = !arraysEqual(draftSelectedIds, selectedDocumentIds);
  const allSelected = sources.length > 0 && draftSelectedCount === sources.length;
  const someSelected = draftSelectedCount > 0 && draftSelectedCount < sources.length;

  const handleToggleSource = useCallback((sourceId: string, checked: boolean) => {
    setDraftSelectedIds((current) => {
      if (checked) {
        return current.includes(sourceId) ? current : [...current, sourceId];
      }

      return current.filter((id) => id !== sourceId);
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setDraftSelectedIds(sources.map((source) => source.id));
  }, [sources]);

  const handleClear = useCallback(() => {
    setDraftSelectedIds([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!directoryId || draftSelectedCount === 0 || isSaving) {
      return;
    }

    setSaveError(null);

    try {
      await updateDirectoryChatSources({
        directoryId,
        selectedDocumentIds: draftSelectedIds,
      }).unwrap();
      setOpen(false);
    } catch (error) {
      const hasErrorMessage = (
        err: unknown,
      ): err is { data: { message: string } } =>
        typeof err === 'object' &&
        err !== null &&
        'data' in err &&
        typeof err.data === 'object' &&
        err.data !== null &&
        'message' in err.data &&
        typeof err.data.message === 'string';

      setSaveError(
        hasErrorMessage(error)
          ? error.data.message
          : 'Failed to update chat sources',
      );
    }
  }, [
    directoryId,
    draftSelectedCount,
    draftSelectedIds,
    isSaving,
    updateDirectoryChatSources,
  ]);

  const sourceLabel =
    totalSourceCount === 0
      ? 'No sources'
      : `${selectedCount}/${totalSourceCount} ${
          totalSourceCount === 1 ? 'source' : 'sources'
        }`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled || totalSourceCount === 0}>
        <button
          type="button"
          className={cn(
            'inline-flex max-w-full items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          aria-label="Manage chat sources"
        >
          <span className="truncate">{sourceLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-72 rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Chat sources</p>
              <p className="text-xs text-muted-foreground">
                Choose which documents are used for future messages.
              </p>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search sources..."
                className="h-8 pl-8 text-sm"
                aria-label="Search chat sources"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleSelectAll}
                disabled={allSelected || sources.length === 0}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleClear}
                disabled={draftSelectedCount === 0}
              >
                Clear
              </Button>
            </div>

            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {filteredSources.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No matching sources.
                </p>
              ) : (
                filteredSources.map((source) => (
                  <Checkbox
                    key={source.id}
                    checked={draftSelectedIds.includes(source.id)}
                    onChange={(checked) => handleToggleSource(source.id, checked)}
                    label={source.title}
                    className="rounded-md px-1 py-1 hover:bg-muted/40"
                  />
                ))
              )}
            </div>

            {draftSelectedCount === 0 ? (
              <p className="text-xs text-destructive">
                Select at least one source to chat.
              </p>
            ) : null}

            {saveError ? (
              <p className="text-xs text-destructive">{saveError}</p>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(checked) => {
                  if (checked) {
                    handleSelectAll();
                    return;
                  }
                  handleClear();
                }}
                label="All sources"
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                disabled={!hasDraftChanges || draftSelectedCount === 0 || isSaving}
                onClick={() => void handleSave()}
                className="gap-2"
              >
                {isSaving ? <Spinner size="xs" variant="on-primary" /> : null}
                Apply
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
