import type { Directory, DirectoryTreeNode, GetDirectoryAncestorsResponse, GetDirectoryTreeResponse } from '@shared-types';
import { fetchUserDoc } from './firestoreReadUtils';

export function fetchDirectoryFromFirestore(
  userId: string,
  directoryId: string,
): Promise<Directory | null> {
  return fetchUserDoc<Directory>(userId, 'directories', directoryId);
}

function flattenDirectoriesFromTree(nodes: DirectoryTreeNode[]): Map<string, Directory> {
  const map = new Map<string, Directory>();

  function walk(treeNodes: DirectoryTreeNode[]) {
    for (const node of treeNodes) {
      map.set(node.directory.id, node.directory);
      walk(node.children);
    }
  }

  walk(nodes);
  return map;
}

export function deriveAncestorsFromTree(
  tree: GetDirectoryTreeResponse,
  directoryId: string,
): GetDirectoryAncestorsResponse | null {
  const directoryMap = flattenDirectoriesFromTree(tree.tree);
  const directory = directoryMap.get(directoryId);
  if (!directory) {
    return null;
  }

  const ancestors: Directory[] = [];
  let currentId = directory.parentId;

  while (currentId) {
    const parent = directoryMap.get(currentId);
    if (!parent) {
      return null;
    }
    ancestors.unshift(parent);
    currentId = parent.parentId;
  }

  return { ancestors };
}
