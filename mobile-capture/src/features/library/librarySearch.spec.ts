import { describe, expect, it } from 'vitest';
import type { DirectoryItemSummary } from '@shared-types';
import {
  directoryPath,
  searchLibrary,
  type ILibrarySearchIndex,
  type ISearchDirectory,
} from './librarySearch';

function directory(
  id: string,
  name: string,
  parentId: string | null,
): ISearchDirectory {
  return { id, name, parentId };
}

function item(
  sourceId: string,
  title: string,
  itemType: DirectoryItemSummary['itemType'],
  directoryId: string,
): DirectoryItemSummary {
  return {
    id: `${itemType}_${sourceId}`,
    sourceId,
    title,
    itemType,
    directoryId,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

const index: ILibrarySearchIndex = {
  directories: [
    directory('bio', 'Biology 201', null),
    directory('cell', 'Cell Biology', 'bio'),
  ],
  items: [
    item('d1', 'Mitochondria and ATP synthesis', 'document', 'cell'),
    item('d2', 'Membrane transport', 'document', 'cell'),
    item('q1', 'Cellular respiration quiz', 'quiz', 'cell'),
    item('cell', 'Cell Biology', 'subdirectory', 'bio'),
  ],
};

describe('searchLibrary', () => {
  it('matches every token against titles across groups', () => {
    const results = searchLibrary(index, 'mito atp');
    expect(results.documents.map((hit) => hit.id)).toEqual(['d1']);
    expect(results.documents[0]?.path).toBe('Biology 201 › Cell Biology');
  });

  it('ranks title-prefix matches first and keeps subdirectory rows out of items', () => {
    const results = searchLibrary(index, 'cell');
    expect(results.directories.map((hit) => hit.id)).toEqual(['cell']);
    expect(results.artifacts.map((hit) => hit.id)).toEqual(['q1']);
    expect(results.documents).toEqual([]);
  });

  it('returns nothing for a blank query', () => {
    expect(searchLibrary(index, '   ')).toEqual({
      directories: [],
      documents: [],
      artifacts: [],
    });
  });
});

describe('directoryPath', () => {
  it('builds a breadcrumb from the root', () => {
    expect(directoryPath(index.directories, 'cell')).toBe(
      'Biology 201 › Cell Biology',
    );
  });
});
