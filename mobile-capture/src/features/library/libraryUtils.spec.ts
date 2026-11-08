import { describe, expect, it } from 'vitest';
import type { DirectoryItemSummary } from '@shared-types';
import type { IGetDirectoryTreeResponse } from '../../lib/api/studyforgeApiSchemas';
import { filterTitle, flattenTree, getBreadcrumbs, getItemWebUrl, getLibraryLocationStorageKey, resolveDirectoryId, restoreLibraryDirectoryId, sortItems } from './libraryUtils';
import { queryKeys } from '../../lib/api/queryKeys';

type IDirectory = IGetDirectoryTreeResponse['tree'][number]['directory'];
function directory(id: string, parentId: string | null): IDirectory {
  return { id, userId: 'user', name: id, parentId, path: `/${id}`, level: parentId ? 1 : 0, documentCount: 0, childCount: 0, quizCount: 0, flashcardSetCount: 0, slideDeckCount: 0, ruleIds: [], createdAt: new Date(), updatedAt: new Date() };
}
function item(id: string, title: string, itemType: DirectoryItemSummary['itemType'], sortOrder?: number): DirectoryItemSummary {
  return { id, title, itemType, sourceId: id, directoryId: 'folder', createdAt: new Date(), sortOrder };
}

describe('library navigation', () => {
  const root = directory('root', null);
  const child = directory('child', 'root');
  const nested = directory('nested', 'child');
  it('restores an empty or missing stored location as the library root', () => {
    expect(restoreLibraryDirectoryId('')).toBeNull();
    expect(restoreLibraryDirectoryId(undefined)).toBeNull();
    expect(restoreLibraryDirectoryId('child')).toBe('child');
  });
  it('flattens the tree, returns breadcrumbs and drops missing saved directories', () => {
    const directories = flattenTree([{ directory: root, children: [{ directory: child, children: [{ directory: nested, children: [] }] }] }]);
    expect(getBreadcrumbs(directories, 'nested').map((entry) => entry.id)).toEqual(['root', 'child', 'nested']);
    expect(resolveDirectoryId(directories, 'missing')).toBeNull();
    expect(resolveDirectoryId(directories, 'child')).toBe('child');
  });
  it('filters only supplied entries and orders manual entries before alphabetical entries', () => {
    const entries = [item('z', 'Zebra', 'document'), item('b', 'Beta', 'document', 2), item('a', 'Alpha', 'document', 1), item('c', 'Alpha', 'document')];
    expect(sortItems(entries).map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'z']);
    expect(filterTitle(entries, ' ALP ').map((entry) => entry.id)).toEqual(['a', 'c']);
  });
  it('uses separate cache and browsing keys for each account', () => {
    expect(getLibraryLocationStorageKey('user-a')).not.toBe(getLibraryLocationStorageKey('user-b'));
    expect(queryKeys.directoryItems('user-a', 'folder')).not.toEqual(queryKeys.directoryItems('user-b', 'folder'));
    expect(queryKeys.document('user-a', 'doc')).not.toEqual(queryKeys.document('user-b', 'doc'));
  });
  it.each([
    ['document', '/document/x'], ['quiz', '/quiz/x?directoryId=folder'], ['flashcard', '/flashcards/x?directoryId=folder'],
    ['slideDeck', '/slides/x?directoryId=folder'], ['diagramQuiz', '/diagram-quiz/x?directoryId=folder'],
    ['sequenceQuiz', '/sequence-quiz/x?directoryId=folder'], ['matchQuiz', '/match-quiz/x?directoryId=folder'],
  ] as const)('opens %s with the matching web route', (type, path) => {
    expect(getItemWebUrl('https://example.com/', item('x', 'X', type))).toBe(`https://example.com${path}`);
  });
});
