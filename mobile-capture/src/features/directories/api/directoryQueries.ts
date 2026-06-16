import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/api/queryKeys';
import { createDocument, generateFromScreenshot, getDirectoryTree } from '../../../lib/api/studyforgeApi';
import type { IGetDirectoryTreeResponse } from '../../../lib/api/studyforgeApiSchemas';

export type IMobileDirectory = IGetDirectoryTreeResponse['tree'][number]['directory'];

export function filterDirectories(directories: IMobileDirectory[], query: string): IMobileDirectory[] {
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

export function flattenDirectoryTree(nodes: IGetDirectoryTreeResponse['tree']): IMobileDirectory[] {
  const directories: IMobileDirectory[] = [];

  const walk = (treeNodes: IGetDirectoryTreeResponse['tree']) => {
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
