import type { Directory, DirectoryTreeNode } from '@shared-types';

export function findTreeNode(
  tree: DirectoryTreeNode[] | undefined,
  directoryId: string,
): DirectoryTreeNode | undefined {
  if (!tree) {
    return undefined;
  }

  for (const node of tree) {
    if (node.directory.id === directoryId) {
      return node;
    }

    const found = findTreeNode(node.children, directoryId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function getChildDirectories(node: DirectoryTreeNode): Directory[] {
  return node.children.map((child) => child.directory);
}

export function getRootDirectories(tree: DirectoryTreeNode[]): Directory[] {
  return tree.map((node) => node.directory);
}

export function getSubdirectoriesForParent(
  tree: DirectoryTreeNode[] | undefined,
  parentDirectoryId: string | null,
): Directory[] | undefined {
  if (!tree) {
    return undefined;
  }

  if (parentDirectoryId === null) {
    return getRootDirectories(tree);
  }

  const parentNode = findTreeNode(tree, parentDirectoryId);
  if (!parentNode) {
    return [];
  }

  return getChildDirectories(parentNode);
}

export function getDirectoryNameFromTree(
  tree: DirectoryTreeNode[] | undefined,
  directoryId: string | null,
): string | undefined {
  if (!directoryId || !tree) {
    return undefined;
  }

  return findTreeNode(tree, directoryId)?.directory.name;
}
