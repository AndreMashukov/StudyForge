import type { Draft } from '@reduxjs/toolkit';
import {
  type ArtifactSummary,
  type ArtifactSummaryType,
  type DocumentEnhanced,
  type GetDirectoryContentsWithArtifactSummariesResponse,
  type ReorderableDirectoryItemType,
} from '@shared-types';
import type { AppDispatch, RootState } from '../../index';
import { baseApi } from '../baseApi';
import { directoryApi } from './DirectoryApi';

interface DirectoryContentsQueryArgs {
  directoryId: string | null;
  artifactLimit?: number;
  artifactCursor?: string;
  includeRules?: boolean;
}

function forEachDirectoryContentsCache(
  state: RootState,
  fn: (args: DirectoryContentsQueryArgs) => void,
  directoryId?: string,
): void {
  const queries = state[baseApi.reducerPath].queries;
  for (const entry of Object.values(queries)) {
    if (
      !entry ||
      entry.endpointName !== 'getDirectoryContentsWithArtifactSummaries'
    ) {
      continue;
    }
    const args = entry.originalArgs as DirectoryContentsQueryArgs | undefined;
    if (!args?.directoryId) {
      continue;
    }
    if (directoryId && args.directoryId !== directoryId) {
      continue;
    }
    fn(args);
  }
}

function directoryItemTypeToArtifactType(
  itemType: ReorderableDirectoryItemType,
): ArtifactSummaryType | null {
  if (itemType === 'document') {
    return null;
  }
  return itemType;
}

export function reorderDirectoryContentsDraft(
  draft: Draft<GetDirectoryContentsWithArtifactSummariesResponse>,
  itemType: ReorderableDirectoryItemType,
  orderedSourceIds: string[],
): void {
  if (itemType === 'document') {
    const byId = new Map(draft.documents.map((doc) => [doc.id, doc]));
    draft.documents = orderedSourceIds
      .map((id) => byId.get(id))
      .filter((doc): doc is DocumentEnhanced => doc !== undefined);
    return;
  }

  const artifactType = directoryItemTypeToArtifactType(itemType);
  if (!artifactType) {
    return;
  }

  const byId = new Map<string, ArtifactSummary>();
  for (const item of draft.artifactSummaries) {
    if (item.type === artifactType) {
      byId.set(item.id, item);
    }
  }

  let reorderedIndex = 0;
  draft.artifactSummaries = draft.artifactSummaries.map((item) => {
    if (item.type !== artifactType) {
      return item;
    }
    const nextId = orderedSourceIds[reorderedIndex];
    reorderedIndex += 1;
    if (!nextId) {
      return item;
    }
    return byId.get(nextId) ?? item;
  });
}

export function patchReorderInAllDirectoryContentsCaches(
  dispatch: AppDispatch,
  getState: () => RootState,
  directoryId: string,
  itemType: ReorderableDirectoryItemType,
  orderedSourceIds: string[],
): Array<{ undo: () => void }> {
  const patches: Array<{ undo: () => void }> = [];
  forEachDirectoryContentsCache(
    getState(),
    (args) => {
      patches.push(
        dispatch(
          directoryApi.util.updateQueryData(
            'getDirectoryContentsWithArtifactSummaries',
            args,
            (draft) => {
              reorderDirectoryContentsDraft(draft, itemType, orderedSourceIds);
            },
          ),
        ),
      );
    },
    directoryId,
  );
  return patches;
}
