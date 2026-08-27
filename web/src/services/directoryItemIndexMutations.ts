import {
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  buildDirectoryItemId,
  type DirectoryItemSummary,
  type DirectoryItemType,
  type GenerationStatus,
  type ReorderDirectoryItemsRequest,
  type ReorderDirectoryItemsResponse,
} from '@shared-types';
import { db } from '../config/firebase';
import {
  directoryItemRef,
  directoryItemsCollection,
  directoryRef,
  documentRef,
  diagramQuizRef,
  flashcardSetRef,
  quizRef,
  sequenceQuizRef,
  slideDeckRef,
} from './firestorePaths';

type FirestoreRecord = Record<string, unknown>;

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

function readTimestamp(value: unknown): DirectoryItemSummary['createdAt'] {
  if (
    value instanceof Timestamp
    || value instanceof Date
    || typeof value === 'string'
  ) {
    return value;
  }
  if (
    value
    && typeof value === 'object'
    && 'toDate' in value
    && typeof value.toDate === 'function'
  ) {
    return value as DirectoryItemSummary['createdAt'];
  }
  return Timestamp.now();
}

function readGenerationStatus(value: unknown): GenerationStatus | undefined {
  if (value === 'pending' || value === 'completed' || value === 'failed') {
    return value;
  }
  return undefined;
}

function readOptionalTimestamp(
  value: unknown,
): DirectoryItemSummary['completedAt'] {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readTimestamp(value);
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
    createdAt: readTimestamp(raw.createdAt),
    updatedAt: readTimestamp(raw.updatedAt),
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
    createdAt: readTimestamp(raw.createdAt),
    updatedAt: readTimestamp(raw.updatedAt),
    generationStatus: readGenerationStatus(raw.generationStatus),
    generationError:
      typeof raw.generationError === 'string' ? raw.generationError : undefined,
    completedAt: readOptionalTimestamp(raw.completedAt),
    appliedRuleIds: readStringArray(raw.appliedRuleIds),
    generationModel:
      typeof raw.generationModel === 'string' ? raw.generationModel : undefined,
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
    createdAt: readTimestamp(raw.createdAt),
    updatedAt: readTimestamp(raw.updatedAt),
    generationStatus: readGenerationStatus(raw.generationStatus),
    generationError:
      typeof raw.generationError === 'string' ? raw.generationError : undefined,
    completedAt: readOptionalTimestamp(raw.completedAt),
    appliedRuleIds: readStringArray(raw.appliedRuleIds),
    generationModel:
      typeof raw.generationModel === 'string' ? raw.generationModel : undefined,
    documentColor:
      typeof raw.documentColor === 'string' ? raw.documentColor : undefined,
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
    console.warn('Directory index sync failed', {
      label,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getMinSortOrderForType(
  userId: string,
  directoryId: string,
  itemType: DirectoryItemType,
): Promise<number | null> {
  const snapshot = await getDocs(
    query(
      directoryItemsCollection(userId, directoryId),
      where('itemType', '==', itemType),
    ),
  );

  let min: number | null = null;
  for (const itemDoc of snapshot.docs) {
    const sortOrder = itemDoc.data().sortOrder;
    if (typeof sortOrder === 'number') {
      min = min === null ? sortOrder : Math.min(min, sortOrder);
    }
  }
  return min;
}

async function ensureSortOrderForNewItem(
  userId: string,
  directoryId: string,
  item: DirectoryItemSummary,
): Promise<DirectoryItemSummary> {
  if (item.itemType === 'subdirectory' || typeof item.sortOrder === 'number') {
    return item;
  }

  const minSortOrder = await getMinSortOrderForType(
    userId,
    directoryId,
    item.itemType,
  );
  if (minSortOrder === null) {
    return item;
  }

  return {
    ...item,
    sortOrder: minSortOrder - 1,
  };
}

export async function upsertDirectoryItem(
  userId: string,
  directoryId: string,
  item: DirectoryItemSummary,
): Promise<void> {
  const enriched = await ensureSortOrderForNewItem(userId, directoryId, item);
  await setDoc(
    directoryItemRef(userId, directoryId, enriched.id),
    stripUndefined({ ...enriched }),
    { merge: true },
  );
}

export async function reorderDirectoryItems(
  userId: string,
  request: ReorderDirectoryItemsRequest,
): Promise<ReorderDirectoryItemsResponse> {
  const { directoryId, itemType, orderedSourceIds } = request;

  if (!Array.isArray(orderedSourceIds) || orderedSourceIds.length === 0) {
    throw new Error('orderedSourceIds must be a non-empty array');
  }

  const directorySnap = await getDoc(directoryRef(userId, directoryId));
  if (!directorySnap.exists()) {
    throw new Error('Directory not found');
  }

  const snapshot = await getDocs(
    query(
      directoryItemsCollection(userId, directoryId),
      where('itemType', '==', itemType),
    ),
  );

  const itemsBySourceId = new Map<string, ReturnType<typeof doc>>();
  for (const itemDoc of snapshot.docs) {
    const data = itemDoc.data() as DirectoryItemSummary;
    itemsBySourceId.set(data.sourceId, itemDoc.ref);
  }

  for (const sourceId of orderedSourceIds) {
    if (!itemsBySourceId.has(sourceId)) {
      throw new Error(`Item not found: ${sourceId}`);
    }
  }

  const orderedSet = new Set(orderedSourceIds);
  const batch = writeBatch(db);

  orderedSourceIds.forEach((sourceId, index) => {
    const ref = itemsBySourceId.get(sourceId);
    if (ref) {
      batch.update(ref, { sortOrder: index });
    }
  });

  for (const itemDoc of snapshot.docs) {
    const data = itemDoc.data() as DirectoryItemSummary;
    if (!orderedSet.has(data.sourceId)) {
      batch.update(itemDoc.ref, { sortOrder: deleteField() });
    }
  }

  await batch.commit();
  return { success: true };
}

export async function removeDirectoryItem(
  userId: string,
  directoryId: string,
  itemType: DirectoryItemType,
  sourceId: string,
): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(
    directoryItemRef(userId, directoryId, buildDirectoryItemId(itemType, sourceId)),
  );
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

export async function deleteAllDirectoryItems(
  userId: string,
  directoryId: string,
): Promise<number> {
  const snapshot = await getDocs(directoryItemsCollection(userId, directoryId));
  if (snapshot.empty) {
    return 0;
  }

  let deleted = 0;
  for (let i = 0; i < snapshot.docs.length; i += 500) {
    const chunk = snapshot.docs.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach((itemDoc) => batch.delete(itemDoc.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

export async function syncDocumentDirectoryIndex(
  userId: string,
  documentId: string,
): Promise<void> {
  const snap = await getDoc(documentRef(userId, documentId));
  if (!snap.exists()) {
    return;
  }
  const item = documentToDirectoryItem(documentId, snap.data());
  if (!item) {
    return;
  }
  await upsertDirectoryItem(userId, item.directoryId, item);
}

export async function syncArtifactDirectoryIndex(
  userId: string,
  itemType: DirectoryItemType,
  artifactId: string,
): Promise<void> {
  const artifactRef = getArtifactRef(userId, itemType, artifactId);
  const snap = await getDoc(artifactRef);
  if (!snap.exists()) {
    return;
  }
  const item = artifactToDirectoryItem(artifactId, itemType, snap.data());
  if (!item) {
    return;
  }
  await upsertDirectoryItem(userId, item.directoryId, item);
}

export async function syncSubdirectoryDirectoryIndex(
  userId: string,
  subdirectoryId: string,
): Promise<void> {
  const snap = await getDoc(directoryRef(userId, subdirectoryId));
  if (!snap.exists()) {
    return;
  }
  const parentId = readString(snap.data().parentId);
  if (!parentId) {
    return;
  }
  const item = subdirectoryToDirectoryItem(subdirectoryId, parentId, snap.data());
  await upsertDirectoryItem(userId, parentId, item);
}

export async function removeSubdirectoryDirectoryIndex(
  userId: string,
  parentId: string | null | undefined,
  subdirectoryId: string,
): Promise<void> {
  if (!parentId) {
    return;
  }
  await removeDirectoryItem(userId, parentId, 'subdirectory', subdirectoryId);
}

export async function removeArtifactDirectoryIndex(
  userId: string,
  directoryId: string,
  itemType: DirectoryItemType,
  artifactId: string,
): Promise<void> {
  await removeDirectoryItem(userId, directoryId, itemType, artifactId);
}

export async function deleteDirectoryItemsForDirectories(
  userId: string,
  directoryIds: string[],
): Promise<number> {
  let total = 0;
  for (const directoryId of directoryIds) {
    total += await deleteAllDirectoryItems(userId, directoryId);
  }
  return total;
}

function getArtifactRef(
  userId: string,
  itemType: DirectoryItemType,
  artifactId: string,
) {
  switch (itemType) {
    case 'quiz':
      return quizRef(userId, artifactId);
    case 'flashcard':
      return flashcardSetRef(userId, artifactId);
    case 'slideDeck':
      return slideDeckRef(userId, artifactId);
    case 'diagramQuiz':
      return diagramQuizRef(userId, artifactId);
    case 'sequenceQuiz':
      return sequenceQuizRef(userId, artifactId);
    default:
      throw new Error(`Unsupported artifact item type: ${itemType}`);
  }
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
