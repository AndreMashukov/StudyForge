import type { ILibrarySearchHit } from '@studyforge/client-data/librarySearch/searchTypes';

export interface ILibrarySearchDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Directory the learner is in, when search was opened from one. */
  currentDirectoryId: string | null;
}

export interface ILibrarySearchResultRow {
  id: string;
  hit: ILibrarySearchHit;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export interface ILibrarySearchButton {
  onClick: () => void;
}
