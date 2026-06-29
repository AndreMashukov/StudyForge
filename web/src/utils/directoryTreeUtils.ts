import type { Directory, DirectoryTreeNode, GetDirectoryTreeResponse } from '@shared-types';

/**
 * Builds a nested directory tree from a flat list (mirrors backend DirectoryService.buildTree).
 */
export function buildDirectoryTreeFromDirectories(directories: Directory[]): DirectoryTreeNode[] {
  const nodeMap = new Map<string, DirectoryTreeNode>();
  const rootNodes: DirectoryTreeNode[] = [];

  for (const dir of directories) {
    nodeMap.set(dir.id, {
      directory: dir,
      children: [],
    });
  }

  for (const dir of directories) {
    const node = nodeMap.get(dir.id);
    if (!node) {
      continue;
    }

    if (dir.parentId && nodeMap.has(dir.parentId)) {
      const parentNode = nodeMap.get(dir.parentId);
      if (parentNode) {
        parentNode.children.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

export function buildDirectoryTreeResponse(directories: Directory[]): GetDirectoryTreeResponse {
  return {
    tree: buildDirectoryTreeFromDirectories(directories),
    totalDirectories: directories.length,
  };
}

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
