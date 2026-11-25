import { describe, expect, it } from 'vitest';
import type { Directory, DirectoryTreeNode } from '@shared-types';
import {
  applyFolderOrderToTree,
  buildDirectoryTreeFromDirectories,
} from './directoryTreeUtils';

function folder(
  id: string,
  name: string,
  parentId: string | null,
  sortOrder?: number,
): Directory {
  return {
    id,
    userId: 'u1',
    name,
    parentId,
    path: parentId ? `/${parentId}/${name}` : `/${name}`,
    level: parentId ? 1 : 0,
    documentCount: 0,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    ruleIds: [],
    ...(sortOrder === undefined ? {} : { sortOrder }),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

const names = (nodes: DirectoryTreeNode[]) =>
  nodes.map((node) => node.directory.name);

describe('buildDirectoryTreeFromDirectories', () => {
  it('orders each level by manual position, then A–Z', () => {
    const tree = buildDirectoryTreeFromDirectories([
      folder('a', 'AWS', null),
      folder('h', 'Healwith', null, 0),
      folder('c', 'Cooking', null),
      folder('h2', 'Zeta', 'h'),
      folder('h1', 'Alpha', 'h', 0),
    ]);
    expect(names(tree)).toEqual(['Healwith', 'AWS', 'Cooking']);
    expect(names(tree[0].children)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('applyFolderOrderToTree', () => {
  it('reorders one parent level and leaves other levels alone', () => {
    const tree = buildDirectoryTreeFromDirectories([
      folder('a', 'AWS', null),
      folder('h', 'Healwith', null),
      folder('x', 'Beta', 'h'),
      folder('y', 'Alpha', 'h'),
    ]);
    const positions = new Map([
      ['x', 0],
      ['y', 1],
    ]);
    applyFolderOrderToTree(tree, 'h', (id) => positions.get(id));
    expect(names(tree)).toEqual(['AWS', 'Healwith']);
    expect(names(tree[1].children)).toEqual(['Beta', 'Alpha']);
  });

  it('clears positions to go back to A–Z', () => {
    const tree = buildDirectoryTreeFromDirectories([
      folder('z', 'Zoo', null, 0),
      folder('a', 'Ant', null, 1),
    ]);
    expect(names(tree)).toEqual(['Zoo', 'Ant']);
    applyFolderOrderToTree(tree, null, () => undefined);
    expect(names(tree)).toEqual(['Ant', 'Zoo']);
    expect(tree[0].directory.sortOrder).toBeUndefined();
  });
});
