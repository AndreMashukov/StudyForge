import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  buildDirectoryItemId,
  type Directory,
  type DirectoryItemSummary,
  type DirectoryItemType,
  directoryItemTypeToArtifactSummaryType,
  type ArtifactSummary,
} from '@shared-types';
import { FirestorePaths } from '../lib/firestore-paths';
import {
  applyOrderedQueryWithCursor,
  buildNextCursor,
  trimPage,
} from '../lib/cursor-pagination';

type FirestoreRecord = FirebaseFirestore.DocumentData;

const ARTIFACT_COLLECTIONS: Array<{
  itemType: DirectoryItemType;
  query: (userId: string) => FirebaseFirestore.CollectionReference;
  doc: (userId: string, artifactId: string) => FirebaseFirestore.DocumentReference;
}> = [
  {
    itemType: 'quiz',
    query: (userId) => FirestorePaths.quizzes(userId),
    doc: (userId, artifactId) => FirestorePaths.quiz(userId, artifactId),
  },
  {
    itemType: 'flashcard',
    query: (userId) => FirestorePaths.flashcardSets(userId),
    doc: (userId, artifactId) => FirestorePaths.flashcardSet(userId, artifactId),
  },
  {
    itemType: 'slideDeck',
    query: (userId) => FirestorePaths.slideDecks(userId),
    doc: (userId, artifactId) => FirestorePaths.slideDeck(userId, artifactId),
  },
  {
    itemType: 'diagramQuiz',
    query: (userId) => FirestorePaths.diagramQuizzes(userId),
    doc: (userId, artifactId) => FirestorePaths.diagramQuiz(userId, artifactId),
  },
  {
    itemType: 'sequenceQuiz',
    query: (userId) => FirestorePaths.sequenceQuizzes(userId),
    doc: (userId, artifactId) => FirestorePaths.sequenceQuiz(userId, artifactId),
  },
  {
    itemType: 'subjectWorld',
    query: (userId) => FirestorePaths.subjectWorlds(userId),
    doc: (userId, artifactId) => FirestorePaths.subjectWorld(userId, artifactId),
  },
];

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }
  return result as T;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function subdirectoryToDirectoryItem(
  subdirectoryId: string,
  parentDirectoryId: string,
  raw: FirestoreRecord,
): DirectoryItemSummary {
  const name = readString(raw.name, 'Untitled');
  return stripUndefined({
    id: buildDirectoryItemId('subdirectory', subdirectoryId),
    sourceId: subdirectoryId,
    directoryId: parentDirectoryId,
    itemType: 'subdirectory' as const,
    title: name,
    createdAt: raw.createdAt ?? Timestamp.now(),
    updatedAt: raw.updatedAt,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    sortName: name.toLowerCase(),
  });
}

export function documentToDirectoryItem(
  documentId: string,
  raw: FirestoreRecord,
): DirectoryItemSummary | null {
  const directoryId = readString(raw.directoryId);
  if (!directoryId) {
    return null;
  }

  return stripUndefined({
    id: buildDirectoryItemId('document', documentId),
    sourceId: documentId,
    directoryId,
    itemType: 'document' as const,
    title: readString(raw.title, 'Untitled Document'),
    createdAt: raw.createdAt ?? Timestamp.now(),
    updatedAt: raw.updatedAt,
    generationStatus: raw.generationStatus,
    generationError: typeof raw.generationError === 'string' ? raw.generationError : undefined,
    completedAt: raw.completedAt,
    appliedRuleIds: readStringArray(raw.appliedRuleIds),
    generationModel: typeof raw.generationModel === 'string' ? raw.generationModel : undefined,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : undefined,
  });
}

export function artifactToDirectoryItem(
  artifactId: string,
  itemType: DirectoryItemType,
  raw: FirestoreRecord,
): DirectoryItemSummary | null {
  const directoryId = readString(raw.directoryId);
  if (!directoryId) {
    return null;
  }

  return stripUndefined({
    id: buildDirectoryItemId(itemType, artifactId),
    sourceId: artifactId,
    directoryId,
    itemType,
    title: readString(raw.title, 'Untitled'),
    createdAt: raw.createdAt ?? Timestamp.now(),
    updatedAt: raw.updatedAt,
    generationStatus: raw.generationStatus,
    generationError: typeof raw.generationError === 'string' ? raw.generationError : undefined,
    completedAt: raw.completedAt,
    appliedRuleIds: readStringArray(raw.appliedRuleIds),
    generationModel: typeof raw.generationModel === 'string' ? raw.generationModel : undefined,
    documentColor: typeof raw.documentColor === 'string' ? raw.documentColor : undefined,
    documentColors: readStringArray(raw.documentColors),
  });
}

export async function syncIndexSafely(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logger.warn('Directory index sync failed', {
      label,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function upsertDirectoryItem(
  userId: string,
  directoryId: string,
  item: DirectoryItemSummary,
): Promise<void> {
  await FirestorePaths.directoryItem(userId, directoryId, item.id).set(
    stripUndefined({ ...item }),
    { merge: true },
  );
}

export async function removeDirectoryItem(
  userId: string,
  directoryId: string,
  itemType: DirectoryItemType,
  sourceId: string,
): Promise<void> {
  await FirestorePaths.directoryItem(
    userId,
    directoryId,
    buildDirectoryItemId(itemType, sourceId),
  ).delete();
}

export async function moveDirectoryItem(
  userId: string,
  fromDirectoryId: string,
  toDirectoryId: string,
  item: DirectoryItemSummary,
): Promise<void> {
  await removeDirectoryItem(userId, fromDirectoryId, item.itemType, item.sourceId);
  await upsertDirectoryItem(userId, toDirectoryId, {
    ...item,
    directoryId: toDirectoryId,
  });
}

export async function deleteAllDirectoryItems(userId: string, directoryId: string): Promise<number> {
  const snapshot = await FirestorePaths.directoryItems(userId, directoryId).get();
  if (snapshot.empty) {
    return 0;
  }

  const db = FirestorePaths.directoryItems(userId, directoryId).firestore;
  let deleted = 0;
  for (let i = 0; i < snapshot.docs.length; i += 500) {
    const chunk = snapshot.docs.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

export async function syncDocumentDirectoryIndex(userId: string, documentId: string): Promise<void> {
  const snap = await FirestorePaths.document(userId, documentId).get();
  if (!snap.exists) {
    return;
  }
  const item = documentToDirectoryItem(documentId, snap.data() as FirestoreRecord);
  if (!item) {
    return;
  }
  await upsertDirectoryItem(userId, item.directoryId, item);
}

export async function removeDocumentDirectoryIndex(
  userId: string,
  directoryId: string,
  documentId: string,
): Promise<void> {
  await removeDirectoryItem(userId, directoryId, 'document', documentId);
}

export async function moveDocumentDirectoryIndex(
  userId: string,
  fromDirectoryId: string,
  toDirectoryId: string,
  documentId: string,
): Promise<void> {
  await removeDocumentDirectoryIndex(userId, fromDirectoryId, documentId);
  await syncDocumentDirectoryIndex(userId, documentId);
}

export async function syncArtifactDirectoryIndex(
  userId: string,
  itemType: DirectoryItemType,
  artifactId: string,
): Promise<void> {
  const collection = ARTIFACT_COLLECTIONS.find((entry) => entry.itemType === itemType);
  if (!collection) {
    return;
  }

  const snap = await collection.doc(userId, artifactId).get();
  if (!snap.exists) {
    return;
  }

  const item = artifactToDirectoryItem(artifactId, itemType, snap.data() as FirestoreRecord);
  if (!item) {
    return;
  }
  await upsertDirectoryItem(userId, item.directoryId, item);
}

export async function removeArtifactDirectoryIndex(
  userId: string,
  directoryId: string,
  itemType: DirectoryItemType,
  artifactId: string,
): Promise<void> {
  await removeDirectoryItem(userId, directoryId, itemType, artifactId);
}

export async function syncSubdirectoryDirectoryIndex(
  userId: string,
  subdirectoryId: string,
): Promise<void> {
  const snap = await FirestorePaths.directory(userId, subdirectoryId).get();
  if (!snap.exists) {
    return;
  }
  const data = snap.data() as Directory;
  const parentId = data.parentId;
  if (!parentId) {
    return;
  }
  const item = subdirectoryToDirectoryItem(subdirectoryId, parentId, snap.data() as FirestoreRecord);
  await upsertDirectoryItem(userId, parentId, item);
}

export async function removeSubdirectoryDirectoryIndex(
  userId: string,
  parentDirectoryId: string | null,
  subdirectoryId: string,
): Promise<void> {
  if (!parentDirectoryId) {
    return;
  }
  await removeDirectoryItem(userId, parentDirectoryId, 'subdirectory', subdirectoryId);
}

export async function moveSubdirectoryDirectoryIndex(
  userId: string,
  subdirectoryId: string,
  oldParentId: string | null,
  newParentId: string | null,
): Promise<void> {
  if (oldParentId) {
    await removeSubdirectoryDirectoryIndex(userId, oldParentId, subdirectoryId);
  }
  if (newParentId) {
    await syncSubdirectoryDirectoryIndex(userId, subdirectoryId);
  }
}

async function collectCanonicalItemsForDirectory(
  userId: string,
  directoryId: string,
): Promise<DirectoryItemSummary[]> {
  const items: DirectoryItemSummary[] = [];

  const subdirs = await FirestorePaths.directories(userId)
    .where('parentId', '==', directoryId)
    .get();
  for (const doc of subdirs.docs) {
    items.push(subdirectoryToDirectoryItem(doc.id, directoryId, doc.data()));
  }

  const documents = await FirestorePaths.documents(userId)
    .where('directoryId', '==', directoryId)
    .get();
  for (const doc of documents.docs) {
    const item = documentToDirectoryItem(doc.id, doc.data());
    if (item) {
      items.push(item);
    }
  }

  for (const { itemType, query } of ARTIFACT_COLLECTIONS) {
    const snapshot = await query(userId).where('directoryId', '==', directoryId).get();
    for (const doc of snapshot.docs) {
      const item = artifactToDirectoryItem(doc.id, itemType, doc.data());
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

export interface DirectoryIndexRebuildResult {
  directoryId: string;
  itemCount: number;
}

export interface DirectoryIndexDriftReport {
  directoryId: string;
  canonicalCount: number;
  indexCount: number;
  drift: number;
}

export async function rebuildDirectoryItemsForDirectory(
  userId: string,
  directoryId: string,
): Promise<DirectoryIndexRebuildResult> {
  await deleteAllDirectoryItems(userId, directoryId);
  const items = await collectCanonicalItemsForDirectory(userId, directoryId);

  const db = FirestorePaths.directoryItems(userId, directoryId).firestore;
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    const batch = db.batch();
    for (const item of chunk) {
      batch.set(FirestorePaths.directoryItem(userId, directoryId, item.id), stripUndefined({ ...item }));
    }
    await batch.commit();
  }

  logger.info('Rebuilt directory item index', { userId, directoryId, itemCount: items.length });
  return { directoryId, itemCount: items.length };
}

export async function detectDirectoryIndexDrift(
  userId: string,
  directoryId: string,
): Promise<DirectoryIndexDriftReport> {
  const [canonical, indexSnap] = await Promise.all([
    collectCanonicalItemsForDirectory(userId, directoryId),
    FirestorePaths.directoryItems(userId, directoryId).get(),
  ]);

  return {
    directoryId,
    canonicalCount: canonical.length,
    indexCount: indexSnap.size,
    drift: canonical.length - indexSnap.size,
  };
}

export async function rebuildDirectoryItemsForAllDirectories(userId: string): Promise<number> {
  const directories = await FirestorePaths.directories(userId).get();
  let totalItems = 0;
  for (const dir of directories.docs) {
    const result = await rebuildDirectoryItemsForDirectory(userId, dir.id);
    totalItems += result.itemCount;
  }
  return totalItems;
}

export async function deleteDirectoryItemsForDirectories(
  userId: string,
  directoryIds: string[],
): Promise<void> {
  for (const directoryId of directoryIds) {
    await deleteAllDirectoryItems(userId, directoryId);
  }
}

const ARTIFACT_DIRECTORY_ITEM_TYPES: DirectoryItemType[] = [
  'quiz',
  'flashcard',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'subjectWorld',
];

function directoryItemRecordToSummary(item: DirectoryItemSummary): ArtifactSummary | null {
  const type = directoryItemTypeToArtifactSummaryType(item.itemType);
  if (!type) {
    return null;
  }

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

export async function listPaginatedArtifactSummaries(
  userId: string,
  directoryId: string,
  options: { limit?: number; cursor?: string },
): Promise<{
  artifactSummaries: ArtifactSummary[];
  artifactHasMore: boolean;
  artifactNextCursor?: string;
}> {
  const limit = Math.min(options.limit ?? 20, 100);
  const sortConfig = { sortBy: 'createdAt', sortOrder: 'desc' as const };

  let query = FirestorePaths.directoryItems(userId, directoryId)
    .where('itemType', 'in', ARTIFACT_DIRECTORY_ITEM_TYPES);

  query = applyOrderedQueryWithCursor(query, sortConfig, options.cursor);
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    sortValue: doc.data().createdAt,
    item: {
      id: doc.id,
      ...doc.data(),
    } as DirectoryItemSummary,
  }));

  const { page: pageRows, hasMore } = trimPage(rows, limit);
  const artifactSummaries = pageRows
    .map((row) => directoryItemRecordToSummary(row.item))
    .filter((summary): summary is ArtifactSummary => summary !== null);

  const artifactNextCursor = buildNextCursor(
    pageRows,
    hasMore,
    sortConfig,
    (row) => row.sortValue,
  );

  return {
    artifactSummaries,
    artifactHasMore: hasMore,
    artifactNextCursor,
  };
}
