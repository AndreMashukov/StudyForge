import type { LibrarySearchItemType } from '@shared-types';
import { buildDirectoryPathWithOptionalName } from './directoryUrl';

const ITEM_ROUTE_PREFIX: Record<
  Exclude<LibrarySearchItemType, 'directory'>,
  string
> = {
  document: '/document/',
  quiz: '/quiz/',
  flashcard: '/flashcards/',
  slideDeck: '/slides/',
  diagramQuiz: '/diagram-quiz/',
  sequenceQuiz: '/sequence-quiz/',
  matchQuiz: '/match-quiz/',
};

export interface ILibraryItemLocation {
  itemType: LibrarySearchItemType;
  id: string;
  title: string;
  directoryId?: string;
}

/** App route that opens a directory, document or artifact. */
export function buildLibraryItemUrl(item: ILibraryItemLocation): string {
  if (item.itemType === 'directory') {
    return buildDirectoryPathWithOptionalName(item.id, item.title);
  }
  const base = `${ITEM_ROUTE_PREFIX[item.itemType]}${encodeURIComponent(item.id)}`;
  return item.directoryId
    ? `${base}?directoryId=${encodeURIComponent(item.directoryId)}`
    : base;
}
