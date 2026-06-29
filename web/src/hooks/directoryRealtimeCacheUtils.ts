import { Timestamp, type DocumentChange, type DocumentData } from 'firebase/firestore';
import type { AppDispatch } from '../store';
import { directoryApi } from '../store/api/Directory/DirectoryApi';
import type {
  ArtifactSummary,
  ArtifactSummaryType,
  Directory,
  DirectoryTreeNode,
  DocumentEnhanced,
} from '@shared-types';
import { findTreeNode } from '../utils/directoryTreeUtils';

/** Converts Firestore Timestamps to ISO strings so Redux stays serializable. */
export function serializeTimestamp(value: unknown): string | unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
}

export function serializeCommonTimestamps<T extends Record<string, unknown>>(data: T): T {
  return {
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    completedAt: serializeTimestamp(data.completedAt),
  };
}

export function toDocumentEnhanced(id: string, raw: DocumentData): DocumentEnhanced {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as DocumentEnhanced;
}

export function toDirectory(id: string, raw: DocumentData): Directory {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as Directory;
}

export function toArtifactSummary(
  id: string,
  raw: DocumentData,
  type: ArtifactSummaryType,
): ArtifactSummary {
  const data = serializeCommonTimestamps(raw);
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled',
    createdAt: data.createdAt as ArtifactSummary['createdAt'],
    type,
    appliedRuleIds: Array.isArray(data.appliedRuleIds)
      ? data.appliedRuleIds.filter((ruleId): ruleId is string => typeof ruleId === 'string')
      : [],
    generationStatus: data.generationStatus as ArtifactSummary['generationStatus'] | undefined,
    generationError: typeof data.generationError === 'string' ? data.generationError : undefined,
    completedAt: data.completedAt as ArtifactSummary['completedAt'] | undefined,
    generationModel: typeof data.generationModel === 'string' ? data.generationModel : undefined,
    generationModelUsage: Array.isArray(data.generationModelUsage)
      ? (data.generationModelUsage as ArtifactSummary['generationModelUsage'])
      : undefined,
    documentColor: typeof data.documentColor === 'string' ? data.documentColor : undefined,
    documentColors: Array.isArray(data.documentColors)
      ? data.documentColors.filter((color): color is string => typeof color === 'string')
      : undefined,
  };
}

function removeNodeFromTree(nodes: DirectoryTreeNode[], directoryId: string): boolean {
  const rootIndex = nodes.findIndex((node) => node.directory.id === directoryId);
  if (rootIndex >= 0) {
    nodes.splice(rootIndex, 1);
    return true;
  }

  for (const node of nodes) {
    if (removeNodeFromTree(node.children, directoryId)) {
      return true;
    }
  }

  return false;
}

function extractNodeFromTree(
  nodes: DirectoryTreeNode[],
  directoryId: string,
): DirectoryTreeNode | undefined {
  const rootIndex = nodes.findIndex((node) => node.directory.id === directoryId);
  if (rootIndex >= 0) {
    return nodes.splice(rootIndex, 1)[0];
  }

  for (const node of nodes) {
    const extracted = extractNodeFromTree(node.children, directoryId);
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
}

function attachNodeToTree(tree: DirectoryTreeNode[], node: DirectoryTreeNode): void {
  if (!node.directory.parentId) {
    tree.push(node);
    return;
  }

  const parentNode = findTreeNode(tree, node.directory.parentId);
  if (parentNode) {
    parentNode.children.push(node);
    return;
  }

  tree.push(node);
}

function reparentNodeInTree(tree: DirectoryTreeNode[], directory: Directory): void {
  const extracted = extractNodeFromTree(tree, directory.id);
  if (!extracted) {
    insertDirectoryIntoTree(tree, directory);
    return;
  }

  Object.assign(extracted.directory, directory);
  attachNodeToTree(tree, extracted);
}

function insertDirectoryIntoTree(tree: DirectoryTreeNode[], directory: Directory): void {
  const newNode: DirectoryTreeNode = { directory, children: [] };

  if (!directory.parentId) {
    const existingIndex = tree.findIndex((node) => node.directory.id === directory.id);
    if (existingIndex >= 0) {
      tree[existingIndex] = newNode;
    } else {
      tree.push(newNode);
    }
    return;
  }

  const parentNode = findTreeNode(tree, directory.parentId);
  if (!parentNode) {
    return;
  }

  const childIndex = parentNode.children.findIndex((node) => node.directory.id === directory.id);
  if (childIndex >= 0) {
    newNode.children = parentNode.children[childIndex].children;
    parentNode.children[childIndex] = newNode;
  } else {
    parentNode.children.push(newNode);
  }
}

export function patchDirectoryTreeCache(
  dispatch: AppDispatch,
  change: DocumentChange<DocumentData>,
): void {
  const directory = toDirectory(change.doc.id, change.doc.data());

  dispatch(
    directoryApi.util.updateQueryData('getDirectoryTree', undefined, (draft) => {
      if (change.type === 'removed') {
        removeNodeFromTree(draft.tree, directory.id);
        draft.totalDirectories = Math.max(0, draft.totalDirectories - 1);
        return;
      }

      if (change.type === 'added') {
        insertDirectoryIntoTree(draft.tree, directory);
        draft.totalDirectories += 1;
        return;
      }

      const existingNode = findTreeNode(draft.tree, directory.id);
      if (existingNode) {
        if (existingNode.directory.parentId !== directory.parentId) {
          reparentNodeInTree(draft.tree, directory);
        } else {
          Object.assign(existingNode.directory, directory);
        }
      } else {
        insertDirectoryIntoTree(draft.tree, directory);
      }
    }),
  );
}

export function patchDocumentInDirectoryContentsCache(
  dispatch: AppDispatch,
  directoryId: string | null,
  change: DocumentChange<DocumentData>,
): void {
  const docData = toDocumentEnhanced(change.doc.id, change.doc.data());

  dispatch(
    directoryApi.util.updateQueryData('getDirectoryContents', directoryId, (draft) => {
      const index = draft.documents.findIndex((document) => document.id === docData.id);
      if (change.type === 'removed') {
        if (index >= 0) {
          draft.documents.splice(index, 1);
        }
        return;
      }

      if (index >= 0) {
        Object.assign(draft.documents[index], docData);
      } else {
        draft.documents.unshift(docData);
      }
    }),
  );
}

export function patchDocumentInArtifactSummariesCache(
  dispatch: AppDispatch,
  directoryId: string,
  artifactLimit: number,
  change: DocumentChange<DocumentData>,
): void {
  const docData = toDocumentEnhanced(change.doc.id, change.doc.data());
  const queryArgs = { directoryId, artifactLimit };

  dispatch(
    directoryApi.util.updateQueryData(
      'getDirectoryContentsWithArtifactSummaries',
      queryArgs,
      (draft) => {
        const index = draft.documents.findIndex((document) => document.id === docData.id);
        if (change.type === 'removed') {
          if (index >= 0) {
            draft.documents.splice(index, 1);
          }
          return;
        }

        if (index >= 0) {
          Object.assign(draft.documents[index], docData);
        } else {
          draft.documents.unshift(docData);
        }
      },
    ),
  );
}

export function patchArtifactInSummariesCache(
  dispatch: AppDispatch,
  directoryId: string,
  artifactLimit: number,
  change: DocumentChange<DocumentData>,
  artifactType: ArtifactSummaryType,
): void {
  const artifact = toArtifactSummary(change.doc.id, change.doc.data(), artifactType);
  const queryArgs = { directoryId, artifactLimit };

  dispatch(
    directoryApi.util.updateQueryData(
      'getDirectoryContentsWithArtifactSummaries',
      queryArgs,
      (draft) => {
        const index = draft.artifactSummaries.findIndex(
          (summary) => summary.id === artifact.id && summary.type === artifact.type,
        );
        if (change.type === 'removed') {
          if (index >= 0) {
            draft.artifactSummaries.splice(index, 1);
          }
          return;
        }

        if (index >= 0) {
          Object.assign(draft.artifactSummaries[index], artifact);
        } else {
          draft.artifactSummaries.unshift(artifact);
        }
      },
    ),
  );
}
