import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDocs } from 'firebase/firestore';
import type { DirectoryItemSummary } from '@shared-types';
import { directoryItemsCollection } from '@studyforge/client-data/firestorePaths';
import { queryKeys } from '../../lib/api/queryKeys';
import {
  useDirectoryTreeQuery,
  type IMobileDirectory,
} from '../directories/api/directoryQueries';
import { flattenTree } from './libraryUtils';
import { parseDirectoryItems } from './libraryData';
export interface ILibraryIndex {
  directories: IMobileDirectory[];
  items: DirectoryItemSummary[];
}

/**
 * Library-wide index for on-device title search (decision 5). Items live per
 * directory, so this fans out one read per directory and leans on the persisted
 * cache; it refreshes at most every five minutes.
 */
export function useLibraryIndex(userId: string | undefined) {
  const treeQuery = useDirectoryTreeQuery();
  const directories = useMemo(
    () => flattenTree(treeQuery.data?.tree ?? []),
    [treeQuery.data],
  );
  const directoryIds = directories.map((directory) => directory.id).join(',');
  const itemsQuery = useQuery({
    queryKey: [...queryKeys.libraryIndex(userId ?? ''), directoryIds],
    enabled: Boolean(userId && treeQuery.data),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DirectoryItemSummary[]> => {
      if (!userId) throw new Error('Library unavailable');
      const snapshots = await Promise.all(
        directories.map((directory) =>
          getDocs(directoryItemsCollection(userId, directory.id)),
        ),
      );
      return snapshots.flatMap((snapshot) =>
        parseDirectoryItems(snapshot.docs),
      );
    },
  });
  const index = useMemo<ILibraryIndex>(
    () => ({ directories, items: itemsQuery.data ?? [] }),
    [directories, itemsQuery.data],
  );
  return {
    index,
    isLoading: treeQuery.isLoading || itemsQuery.isLoading,
    refetch: itemsQuery.refetch,
  };
}

export { directoryPath, searchLibrary } from './librarySearch';
export type { ISearchHit, ISearchResults } from './librarySearch';
