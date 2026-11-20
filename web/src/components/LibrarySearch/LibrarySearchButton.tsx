import React from 'react';
import { Search } from 'lucide-react';
import type { ILibrarySearchButton } from './ILibrarySearch';

const IS_MAC =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

/** Top-bar entry point for library search. */
export const LibrarySearchButton: React.FC<ILibrarySearchButton> = ({
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Search your library"
    aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
    className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
  >
    <Search size={16} aria-hidden="true" />
    <span className="hidden sm:inline">Search</span>
    <kbd className="hidden rounded border border-border px-1.5 font-sans text-xs sm:inline">
      {IS_MAC ? '⌘K' : 'Ctrl K'}
    </kbd>
  </button>
);
