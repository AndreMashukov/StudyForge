import type { DirectoryItemSummary } from '@shared-types';
import type { ILibraryItemRef } from './itemNavigation';

/** Minimal directory shape the search needs; the mobile directory schema satisfies it. */
export interface ISearchDirectory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ISearchHit extends ILibraryItemRef {
  /** Breadcrumb for the item's directory, e.g. "Biology 201 › Cell Biology". */
  path: string;
  generationStatus?: DirectoryItemSummary['generationStatus'];
  createdAt?: DirectoryItemSummary['createdAt'];
}

export interface ILibrarySearchIndex {
  directories: ISearchDirectory[];
  items: DirectoryItemSummary[];
}

export function directoryPath(
  directories: ISearchDirectory[],
  directoryId: string | null | undefined,
): string {
  const byId = new Map(
    directories.map((directory) => [directory.id, directory]),
  );
  const names: string[] = [];
  const seen = new Set<string>();
  let current = directoryId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const directory = byId.get(current);
    if (!directory) break;
    names.unshift(directory.name);
    current = directory.parentId;
  }
  return names.join(' › ');
}

function toTokens(query: string): string[] {
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreTitle(title: string, tokens: string[]): number {
  const lower = title.toLocaleLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (!lower.includes(token)) return 0;
    score += lower.startsWith(token)
      ? 3
      : lower.split(/\W+/).some((word) => word.startsWith(token))
        ? 2
        : 1;
  }
  return score;
}

export interface ISearchResults {
  directories: ISearchHit[];
  documents: ISearchHit[];
  artifacts: ISearchHit[];
}

/** Every token must appear in the title; prefix and word-start matches rank higher. */
export function searchLibrary(
  index: ILibrarySearchIndex,
  query: string,
  limitPerGroup = 20,
): ISearchResults {
  const tokens = toTokens(query);
  const empty: ISearchResults = {
    directories: [],
    documents: [],
    artifacts: [],
  };
  if (!tokens.length) return empty;

  const ranked = <T extends { title: string }>(rows: T[]) =>
    rows
      .map((row) => ({ row, score: scoreTitle(row.title, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title),
      )
      .slice(0, limitPerGroup)
      .map((entry) => entry.row);

  const directories = ranked(
    index.directories.map((directory) => ({
      itemType: 'directory' as const,
      id: directory.id,
      title: directory.name,
      directoryId: directory.parentId ?? undefined,
      path: directoryPath(index.directories, directory.parentId),
    })),
  );
  const items = index.items
    .filter((item) => item.itemType !== 'subdirectory')
    .map((item): ISearchHit | null => {
      if (item.itemType === 'subdirectory') return null;
      return {
        itemType: item.itemType,
        id: item.sourceId,
        title: item.title,
        directoryId: item.directoryId,
        path: directoryPath(index.directories, item.directoryId),
        generationStatus: item.generationStatus,
        createdAt: item.createdAt,
      };
    })
    .filter((hit): hit is ISearchHit => hit !== null);

  return {
    directories,
    documents: ranked(items.filter((item) => item.itemType === 'document')),
    artifacts: ranked(items.filter((item) => item.itemType !== 'document')),
  };
}
