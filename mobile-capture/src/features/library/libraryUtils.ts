import type { DirectoryItemSummary } from '@shared-types';
import type { IGetDirectoryTreeResponse } from '../../lib/api/studyforgeApiSchemas';

type Directory = IGetDirectoryTreeResponse['tree'][number]['directory'];
type DirectoryTreeNode = IGetDirectoryTreeResponse['tree'][number];

export function getLibraryLocationStorageKey(userId: string): string {
  return `studyforge.mobile.library.lastDirectory.${userId}`;
}

export function restoreLibraryDirectoryId(value: string | undefined): string | null {
  return value || null;
}

export function flattenTree(nodes: DirectoryTreeNode[]): Directory[] {
  return nodes.flatMap((node) => [node.directory, ...flattenTree(node.children)]);
}

export function resolveDirectoryId(directories: Directory[], id: string | null): string | null {
  return id && directories.some((directory) => directory.id === id) ? id : null;
}

export function getBreadcrumbs(directories: Directory[], id: string | null): Directory[] {
  const byId = new Map(directories.map((directory) => [directory.id, directory]));
  const visited = new Set<string>();
  const path: Directory[] = [];
  let current = id;
  while (current && !visited.has(current)) {
    visited.add(current);
    const directory = byId.get(current);
    if (!directory) break;
    path.unshift(directory);
    current = directory.parentId;
  }
  return path;
}

export function filterTitle<T extends { title: string }>(items: T[], search: string): T[] {
  const term = search.trim().toLocaleLowerCase();
  return items.filter((item) => item.title.toLocaleLowerCase().includes(term));
}

export function sortItems(items: DirectoryItemSummary[]): DirectoryItemSummary[] {
  return [...items].sort((a, b) => {
    const aOrder = typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder) ? a.sortOrder : Infinity;
    const bOrder = typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? b.sortOrder : Infinity;
    return aOrder - bOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

const artifactPaths: Partial<Record<DirectoryItemSummary['itemType'], string>> = {
  quiz: 'quiz', flashcard: 'flashcards', slideDeck: 'slides',
  diagramQuiz: 'diagram-quiz', sequenceQuiz: 'sequence-quiz', matchQuiz: 'match-quiz',
};

export function getItemWebUrl(origin: string, item: DirectoryItemSummary): string | null {
  const route = item.itemType === 'document' ? 'document' : artifactPaths[item.itemType];
  if (!route) return null;
  const base = origin.replace(/\/+$/, '');
  const query = item.itemType === 'document' ? '' : `?directoryId=${encodeURIComponent(item.directoryId)}`;
  return `${base}/${route}/${encodeURIComponent(item.sourceId)}${query}`;
}
