import {
  deleteField,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  buildDirectoryItemId,
  type ReorderDirectoriesRequest,
  type ReorderDirectoriesResponse,
  type ResetDirectoryOrderRequest,
} from '@shared-types';
import { getClientDb } from './clientDb';
import {
  directoryItemRef,
  directoryItemsCollection,
  directoryRef,
  userCollection,
} from './firestorePaths';

/** Firestore batches allow 500 writes; each folder takes up to two. */
const MAX_FOLDERS_PER_REORDER = 240;

async function listChildDirectoryIds(
  userId: string,
  parentId: string | null,
): Promise<string[]> {
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'directories'),
      where('parentId', '==', parentId),
    ),
  );
  return snapshot.docs.map((docSnap) => docSnap.id);
}

async function listIndexedSubdirectoryIds(
  userId: string,
  parentId: string,
): Promise<Set<string>> {
  const snapshot = await getDocs(
    query(
      directoryItemsCollection(userId, parentId),
      where('itemType', '==', 'subdirectory'),
    ),
  );
  const ids = new Set<string>();
  for (const itemDoc of snapshot.docs) {
    const sourceId: unknown = itemDoc.get('sourceId');
    if (typeof sourceId === 'string') {
      ids.add(sourceId);
    }
  }
  return ids;
}

/**
 * Writes `sortOrder` (or removes it) on each folder and on its row in the
 * parent's item index, which the folder page reads. Top-level folders have no
 * parent index.
 */
async function writeFolderOrder(
  userId: string,
  parentId: string | null,
  orderFor: (directoryId: string) => number | undefined,
  directoryIds: readonly string[],
): Promise<void> {
  if (directoryIds.length > MAX_FOLDERS_PER_REORDER) {
    throw new Error('Too many folders to reorder at once');
  }
  // Only rows that already exist are updated, so a folder whose index row is
  // missing never gets a half-empty row.
  const indexedIds = parentId
    ? await listIndexedSubdirectoryIds(userId, parentId)
    : new Set<string>();
  const batch = writeBatch(getClientDb());
  for (const directoryId of directoryIds) {
    const order = orderFor(directoryId);
    const value = order === undefined ? deleteField() : order;
    batch.update(directoryRef(userId, directoryId), { sortOrder: value });
    if (parentId && indexedIds.has(directoryId)) {
      batch.update(
        directoryItemRef(
          userId,
          parentId,
          buildDirectoryItemId('subdirectory', directoryId),
        ),
        { sortOrder: value },
      );
    }
  }
  await batch.commit();
}

/** Saves a new order for every folder in a parent (null = top level). */
export async function reorderDirectoriesInFirestore(
  userId: string,
  request: ReorderDirectoriesRequest,
): Promise<ReorderDirectoriesResponse> {
  const { parentId, orderedDirectoryIds } = request;
  if (orderedDirectoryIds.length === 0) {
    throw new Error('orderedDirectoryIds must not be empty');
  }
  if (new Set(orderedDirectoryIds).size !== orderedDirectoryIds.length) {
    throw new Error('orderedDirectoryIds must not repeat a folder');
  }

  const childIds = await listChildDirectoryIds(userId, parentId);
  const children = new Set(childIds);
  for (const directoryId of orderedDirectoryIds) {
    if (!children.has(directoryId)) {
      throw new Error('A folder is no longer in this location');
    }
  }

  // Folders created since the list was loaded keep no position, so they
  // follow the ordered ones in A–Z order.
  const positions = new Map(
    orderedDirectoryIds.map((directoryId, index) => [directoryId, index]),
  );
  await writeFolderOrder(
    userId,
    parentId,
    (directoryId) => positions.get(directoryId),
    childIds,
  );
  return { success: true };
}

/** Clears the manual order of a parent's folders, back to A–Z. */
export async function resetDirectoryOrderInFirestore(
  userId: string,
  request: ResetDirectoryOrderRequest,
): Promise<ReorderDirectoriesResponse> {
  const childIds = await listChildDirectoryIds(userId, request.parentId);
  if (childIds.length > 0) {
    await writeFolderOrder(userId, request.parentId, () => undefined, childIds);
  }
  return { success: true };
}
