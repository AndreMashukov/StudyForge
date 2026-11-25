import type {
  Directory,
  DirectoryTreeNode,
  GetDirectoryTreeResponse,
} from '@shared-types';
import { compareFolderOrder } from '@shared-types';

/** Orders every level of the tree by manual position, then A–Z. */
function sortTreeLevels(nodes: DirectoryTreeNode[]): DirectoryTreeNode[] {
  nodes.sort((left, right) =>
    compareFolderOrder(left.directory, right.directory),
  );
  for (const node of nodes) {
    sortTreeLevels(node.children);
  }
  return nodes;
}

/**
 * Builds a nested directory tree from a flat list (mirrors backend DirectoryService.buildTree).
 */
export function buildDirectoryTreeFromDirectories(
  directories: Directory[],
): DirectoryTreeNode[] {
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

  return sortTreeLevels(rootNodes);
}

export function buildDirectoryTreeResponse(
  directories: Directory[],
): GetDirectoryTreeResponse {
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

function findChildLevel(
  tree: DirectoryTreeNode[],
  parentId: string | null,
): DirectoryTreeNode[] | undefined {
  if (parentId === null) {
    return tree;
  }
  for (const node of tree) {
    if (node.directory.id === parentId) {
      return node.children;
    }
    const nested = findChildLevel(node.children, parentId);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

/**
 * Sets each folder's `sortOrder` under one parent (null = top level) and
 * re-sorts that level. `undefined` removes the manual position. Mutates the
 * tree, for use inside an Immer draft.
 */
export function applyFolderOrderToTree(
  tree: DirectoryTreeNode[],
  parentId: string | null,
  orderFor: (directoryId: string) => number | undefined,
): void {
  const level = findChildLevel(tree, parentId);
  if (!level) {
    return;
  }
  for (const node of level) {
    const order = orderFor(node.directory.id);
    if (order === undefined) {
      delete node.directory.sortOrder;
    } else {
      node.directory.sortOrder = order;
    }
  }
  level.sort((left, right) =>
    compareFolderOrder(left.directory, right.directory),
  );
}
