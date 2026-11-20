import React, { useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import type {
  ILibrarySearchHit,
  ILibrarySearchResults,
} from '@studyforge/client-data/librarySearch/searchTypes';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';
import { cn } from '../../lib/utils';
import { useAppDispatch } from '../../hooks/redux';
import { setAgentLauncherDraft } from '../../store/slices/uiSlice';
import { buildLibraryItemUrl } from '../../utils/libraryItemUrl';
import type { ILibrarySearchDialog } from './ILibrarySearch';
import { LibrarySearchResultRow } from './LibrarySearchResultRow';
import { useLibrarySearchClient } from './hooks/useLibrarySearchClient';

const LISTBOX_ID = 'library-search-results';
const ASK_ROW_ID = 'library-search-ask';

const SECTIONS: Array<{ key: keyof ILibrarySearchResults; label: string }> = [
  { key: 'directories', label: 'Directories' },
  { key: 'documents', label: 'Documents' },
  { key: 'artifacts', label: 'Artifacts' },
];

function rowId(hit: ILibrarySearchHit): string {
  return `library-search-${hit.itemType}-${hit.id}`;
}

type DialogBodyProps = Omit<ILibrarySearchDialog, 'open'>;

/** Mounted only while the dialog is open, so every opening starts clean. */
const LibrarySearchDialogBody: React.FC<DialogBodyProps> = ({
  onOpenChange,
  userId,
  currentDirectoryId,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { client, status } = useLibrarySearchClient(userId);
  const [query, setQuery] = useState('');
  const [scoped, setScoped] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const trimmedQuery = deferredQuery.trim();
  const directoryId = currentDirectoryId && scoped ? currentDirectoryId : null;

  const results = useMemo(
    () =>
      client.search(deferredQuery, directoryId ? { directoryId } : undefined),
    // status.version changes whenever the same query could return something else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, deferredQuery, directoryId, status.version, status.ready],
  );

  const hits = SECTIONS.flatMap((section) => results[section.key]);
  const rowIds = [...hits.map(rowId), ...(trimmedQuery ? [ASK_ROW_ID] : [])];
  const resolvedActiveId =
    activeId && rowIds.includes(activeId) ? activeId : (rowIds[0] ?? null);

  const handleOpenHit = (hit: ILibrarySearchHit) => {
    onOpenChange(false);
    navigate(buildLibraryItemUrl(hit));
  };

  const handleAsk = () => {
    dispatch(setAgentLauncherDraft(trimmedQuery));
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (rowIds.length === 0) return;
      event.preventDefault();
      const current = resolvedActiveId ? rowIds.indexOf(resolvedActiveId) : -1;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = rowIds[(current + step + rowIds.length) % rowIds.length];
      setActiveId(next);
      document.getElementById(next)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && resolvedActiveId) {
      event.preventDefault();
      if (resolvedActiveId === ASK_ROW_ID) {
        handleAsk();
        return;
      }
      const hit = hits.find((candidate) => rowId(candidate) === resolvedActiveId);
      if (hit) handleOpenHit(hit);
    }
  };

  const directoryTitle = currentDirectoryId
    ? (client.getDirectoryTitle(currentDirectoryId) ?? 'this directory')
    : null;

  const renderNotice = () => {
    if (!status.ready) return 'Preparing search…';
    if (!status.hasSynced) {
      return status.syncing
        ? 'Indexing your library…'
        : 'Search needs a connection the first time. Reconnect and try again.';
    }
    if (!trimmedQuery) {
      return 'Search names of directories, documents and artifacts, and the text of your documents.';
    }
    if (hits.length === 0) {
      return directoryId
        ? `Nothing in ${directoryTitle} matches “${trimmedQuery}”.`
        : `Nothing matches “${trimmedQuery}”.`;
    }
    return null;
  };
  const notice = renderNotice();

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border py-3 pl-4 pr-12">
        <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={LISTBOX_ID}
          aria-activedescendant={resolvedActiveId ?? undefined}
          aria-label="Search your library"
          placeholder="Search your library"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        {directoryTitle ? (
          <button
            type="button"
            aria-pressed={scoped}
            onClick={() => setScoped((value) => !value)}
            title={scoped ? 'Search the whole library' : `Search only in ${directoryTitle}`}
            className={cn(
              'max-w-[40%] shrink-0 truncate rounded-full border px-2.5 py-1 text-xs transition-colors',
              scoped
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            In: {directoryTitle}
          </button>
        ) : null}
      </div>

      <div
        id={LISTBOX_ID}
        role="listbox"
        aria-label="Search results"
        className="max-h-[60vh] min-h-0 overflow-y-auto p-2"
      >
        {SECTIONS.map((section) =>
          results[section.key].length > 0 ? (
            <div key={section.key} role="group" aria-label={section.label}>
              <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </div>
              {results[section.key].map((hit) => (
                <LibrarySearchResultRow
                  key={rowId(hit)}
                  id={rowId(hit)}
                  hit={hit}
                  active={rowId(hit) === resolvedActiveId}
                  onSelect={() => handleOpenHit(hit)}
                  onHover={() => setActiveId(rowId(hit))}
                />
              ))}
            </div>
          ) : null,
        )}

        {notice ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}

        {status.ready && !status.bodyTextIndexed && trimmedQuery ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Your library is too large to search inside documents on this
            device. Names are still searched.
          </p>
        ) : null}

        {trimmedQuery ? (
          <div
            id={ASK_ROW_ID}
            role="option"
            aria-selected={resolvedActiveId === ASK_ROW_ID}
            onClick={handleAsk}
            onMouseMove={() => setActiveId(ASK_ROW_ID)}
            className={cn(
              'mt-1 flex cursor-pointer items-center gap-3 rounded-md border-t border-border px-3 py-2',
              resolvedActiveId === ASK_ROW_ID && 'bg-foreground/[0.06]',
            )}
          >
            <Sparkles size={16} aria-hidden="true" className="shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                Ask StudyForge
              </div>
              <div className="truncate text-xs text-muted-foreground">
                “{trimmedQuery}”
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

export const LibrarySearchDialog: React.FC<ILibrarySearchDialog> = ({
  open,
  ...body
}) => (
  <Dialog open={open} onOpenChange={body.onOpenChange}>
    <DialogContent className="max-w-xl gap-0 p-0" aria-describedby={undefined}>
      <DialogTitle className="sr-only">Search your library</DialogTitle>
      <DialogDescription className="sr-only">
        Find directories, documents and artifacts by name, and documents by
        their text.
      </DialogDescription>
      {open ? <LibrarySearchDialogBody {...body} /> : null}
    </DialogContent>
  </Dialog>
);
