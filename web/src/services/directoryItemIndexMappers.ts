import {
  type ArtifactSummary,
  type ArtifactSummaryType,
  type Directory,
  type DirectoryItemSummary,
  type DocumentEnhanced,
  DocumentStatus,
  DocumentSourceType,
  type GetDirectoryContentsWithArtifactSummariesResponse,
  compareFolderOrder,
  directoryItemTypeToArtifactSummaryType,
  sortArtifactsForDisplay,
  sortDocumentsForDisplay,
} from '@shared-types';

function compareSubdirectoryName(
  left: DirectoryItemSummary,
  right: DirectoryItemSummary,
): number {
  return compareFolderOrder(
    { name: left.sortName ?? left.title, sortOrder: left.sortOrder },
    { name: right.sortName ?? right.title, sortOrder: right.sortOrder },
  );
}

function itemToSubdirectory(
  item: DirectoryItemSummary,
  userId: string,
): Directory {
  return {
    id: item.sourceId,
    userId,
    name: item.title,
    parentId: item.directoryId,
    path: '',
    level: 0,
    color: item.color,
    icon: item.icon,
    sortOrder: item.sortOrder,
    documentCount: 0,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    ruleIds: [],
    createdAt: item.createdAt as Directory['createdAt'],
    updatedAt: (item.updatedAt ?? item.createdAt) as Directory['updatedAt'],
  };
}

function itemToDocument(
  item: DirectoryItemSummary,
  userId: string,
): DocumentEnhanced {
  return {
    id: item.sourceId,
    userId,
    title: item.title,
    description: '',
    sourceType: DocumentSourceType.UPLOAD,
    wordCount: item.wordCount ?? 0,
    status: DocumentStatus.ACTIVE,
    storageUrl: '',
    storagePath: '',
    tags: [],
    directoryId: item.directoryId,
    createdAt: item.createdAt as DocumentEnhanced['createdAt'],
    updatedAt: (item.updatedAt ??
      item.createdAt) as DocumentEnhanced['updatedAt'],
    generationStatus: item.generationStatus,
    generationError: item.generationError,
    completedAt: item.completedAt as DocumentEnhanced['completedAt'],
    appliedRuleIds: item.appliedRuleIds,
    generationModel: item.generationModel,
    color: item.color,
  } as DocumentEnhanced;
}

function itemToArtifactSummary(
  item: DirectoryItemSummary,
  type: ArtifactSummaryType,
): ArtifactSummary {
  return {
    id: item.sourceId,
    title: item.title,
    createdAt: item.createdAt,
    type,
    appliedRuleIds: item.appliedRuleIds,
    generationStatus: item.generationStatus,
    generationError: item.generationError,
    completedAt: item.completedAt,
    generationModel: item.generationModel,
    documentColor: item.documentColor,
    documentColors: item.documentColors,
  };
}

function limitArtifactsByType(
  items: DirectoryItemSummary[],
  artifactLimit?: number,
): DirectoryItemSummary[] {
  if (!artifactLimit || artifactLimit <= 0) {
    return items;
  }

  const grouped = new Map<ArtifactSummaryType, DirectoryItemSummary[]>();
  for (const item of items) {
    const artifactType = directoryItemTypeToArtifactSummaryType(item.itemType);
    if (!artifactType) {
      continue;
    }
    const bucket = grouped.get(artifactType) ?? [];
    bucket.push(item);
    grouped.set(artifactType, bucket);
  }

  // Keep the newest `artifactLimit` of each type (artifacts have no manual order).
  const limited: DirectoryItemSummary[] = [];
  for (const bucket of grouped.values()) {
    limited.push(...sortArtifactsForDisplay(bucket).slice(0, artifactLimit));
  }
  return sortArtifactsForDisplay(limited);
}

export function mapDirectoryItemsToContentsResponse(
  directory: Directory,
  items: DirectoryItemSummary[],
  artifactLimit?: number,
): GetDirectoryContentsWithArtifactSummariesResponse {
  const subdirectories = items
    .filter((item) => item.itemType === 'subdirectory')
    .sort(compareSubdirectoryName)
    .map((item) => itemToSubdirectory(item, directory.userId));

  const documents = sortDocumentsForDisplay(
    items.filter((item) => item.itemType === 'document'),
  ).map((item) => itemToDocument(item, directory.userId));

  const artifactItems = limitArtifactsByType(
    items.filter(
      (item) => directoryItemTypeToArtifactSummaryType(item.itemType) !== null,
    ),
    artifactLimit,
  );

  const artifactSummaries = artifactItems.map((item) => {
    const type = directoryItemTypeToArtifactSummaryType(item.itemType);
    if (!type) {
      throw new Error(`Unexpected artifact item type: ${item.itemType}`);
    }
    return itemToArtifactSummary(item, type);
  });

  return {
    directory,
    subdirectories,
    documents,
    artifactSummaries,
    totalCount:
      subdirectories.length + documents.length + artifactSummaries.length,
    resolvedRules: {
      rules: [],
      inheritanceMap: {},
    },
  };
}
