import { useMutation, useQuery } from '@tanstack/react-query';
import { Directory, DirectoryTreeNode } from '@shared-types';
import { queryKeys } from '../../../lib/api/queryKeys';
import { createDocument, generateFromScreenshot, getDirectoryTree } from '../../../lib/api/studyforgeApi';

export function filterDirectories(directories: Directory[], query: string): Directory[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return directories;
  }

  return directories.filter(
    (directory) =>
      directory.name.toLowerCase().includes(normalizedQuery) ||
      directory.path.toLowerCase().includes(normalizedQuery)
  );
}

export function flattenDirectoryTree(nodes: DirectoryTreeNode[]) {
  const directories: DirectoryTreeNode['directory'][] = [];

  const walk = (treeNodes: DirectoryTreeNode[]) => {
    for (const node of treeNodes) {
      directories.push(node.directory);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return directories;
}

export function useDirectoryTreeQuery() {
  return useQuery({
    queryKey: queryKeys.directoryTree,
    queryFn: getDirectoryTree,
  });
}

export function useCreateDocumentMutation() {
  return useMutation({
    mutationFn: createDocument,
  });
}

export function useGenerateFromScreenshotMutation() {
  return useMutation({
    mutationFn: generateFromScreenshot,
  });
}
