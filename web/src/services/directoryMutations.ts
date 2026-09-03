import {
  addDoc,
  deleteDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  CreateDirectoryRequest,
  DeleteDirectoryResponse,
  Directory,
  DirectoryValidationResult,
  MoveDirectoryRequest,
  MoveDirectoryResponse,
  UpdateDirectoryRequest,
} from '@shared-types';
import { DIRECTORY_CONSTRAINTS } from '@shared-types';
import { db } from '../config/firebase';
import { fetchDirectoryFromFirestore } from './directoryFirestore';
import { directoryRef, userCollection } from './firestorePaths';
import {
  deleteDirectoryItemsForDirectories,
  moveSubdirectoryDirectoryIndex,
  removeSubdirectoryDirectoryIndex,
  syncIndexSafely,
  syncSubdirectoryDirectoryIndex,
} from './directoryItemIndexMutations';
import { deleteDocumentInFirestore } from './documentMutations';
import { deleteSlideDeckInFirestore } from './artifactMutations';
import { recalculateStatsForDirectoryMove } from './interactionTrackingMutations';
import {
  fetchAllUserDocsPaginated,
  FIRESTORE_ARTIFACTS_LIST_LIMIT,
  FIRESTORE_DOCUMENTS_LIST_LIMIT,
} from './firestoreReadUtils';

function validateDirectoryName(name: string): DirectoryValidationResult {
  const errors: string[] = [];
  if (!name || name.trim().length === 0) {
    errors.push('Directory name is required');
  }
  if (name.length > DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH) {
    errors.push(
      `Directory name must not exceed ${DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH} characters`,
    );
  }
  const reservedNames = DIRECTORY_CONSTRAINTS.RESERVED_NAMES as readonly string[];
  if (reservedNames.includes(name.toLowerCase())) {
    errors.push('Directory name is reserved');
  }
  if (/[/\\:*?"<>|]/.test(name)) {
    errors.push('Directory name contains invalid characters');
  }
  return { isValid: errors.length === 0, errors };
}

async function findDirectoryByNameAndParent(
  userId: string,
  name: string,
  parentId: string | null,
): Promise<Directory | null> {
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'directories'),
      where('name', '==', name),
      where('parentId', '==', parentId),
      limit(1),
    ),
  );
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Directory;
}

async function getDescendants(userId: string, directoryId: string): Promise<Directory[]> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    return [];
  }
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'directories'),
      where('path', '>=', `${directory.path}/`),
      where('path', '<', `${directory.path}0`),
    ),
  );
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Directory);
}

async function isDescendant(
  userId: string,
  potentialDescendantId: string,
  ancestorId: string,
): Promise<boolean> {
  const ancestor = await fetchDirectoryFromFirestore(userId, ancestorId);
  const candidate = await fetchDirectoryFromFirestore(userId, potentialDescendantId);
  if (!ancestor || !candidate) {
    return false;
  }
  return candidate.path.startsWith(`${ancestor.path}/`);
}

async function updateDescendantPaths(
  userId: string,
  directoryId: string,
  newPath: string,
): Promise<number> {
  const parent = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!parent) {
    return 0;
  }

  const descendants = await getDescendants(userId, directoryId);
  if (descendants.length === 0) {
    return 0;
  }

  const oldPath = parent.path;
  for (let i = 0; i < descendants.length; i += 500) {
    const chunk = descendants.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const descendant of chunk) {
      const updatedPath = descendant.path.replace(oldPath, newPath);
      const pathParts = updatedPath.split('/').filter((part) => part.length > 0);
      batch.update(directoryRef(userId, descendant.id), {
        path: updatedPath,
        level: Math.max(0, pathParts.length - 1),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return descendants.length;
}

export async function createDirectoryInFirestore(
  userId: string,
  request: CreateDirectoryRequest,
): Promise<Directory> {
  const validation = validateDirectoryName(request.name);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  let parentDirectory: Directory | null = null;
  let level = 0;
  let path = `/${request.name}`;

  if (request.parentId) {
    parentDirectory = await fetchDirectoryFromFirestore(userId, request.parentId);
    if (!parentDirectory) {
      throw new Error('Parent directory not found');
    }
    if (parentDirectory.level >= DIRECTORY_CONSTRAINTS.MAX_DEPTH - 1) {
      throw new Error(
        `Maximum directory depth (${DIRECTORY_CONSTRAINTS.MAX_DEPTH}) exceeded`,
      );
    }
    level = parentDirectory.level + 1;
    path = `${parentDirectory.path}/${request.name}`;
  }

  const existingDir = await findDirectoryByNameAndParent(
    userId,
    request.name,
    request.parentId ?? null,
  );
  if (existingDir) {
    throw new Error('Directory with this name already exists at this level');
  }

  const directoryData: Omit<Directory, 'id'> = {
    userId,
    name: request.name,
    parentId: request.parentId ?? null,
    path,
    level,
    ...(request.color !== undefined ? { color: request.color } : {}),
    ...(request.icon !== undefined ? { icon: request.icon } : {}),
    ...(request.description !== undefined ? { description: request.description } : {}),
    documentCount: 0,
    childCount: 0,
    quizCount: 0,
    flashcardSetCount: 0,
    slideDeckCount: 0,
    diagramQuizCount: 0,
    ruleIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await addDoc(userCollection(userId, 'directories'), {
    ...directoryData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (parentDirectory) {
    await updateDoc(directoryRef(userId, parentDirectory.id), {
      childCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  if (request.parentId) {
    await syncIndexSafely('createDirectory', () =>
      syncSubdirectoryDirectoryIndex(userId, docRef.id),
    );
  }

  return { id: docRef.id, ...directoryData };
}

export async function updateDirectoryInFirestore(
  userId: string,
  directoryId: string,
  request: UpdateDirectoryRequest,
): Promise<Directory> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    throw new Error('Directory not found');
  }

  if (request.name) {
    const validation = validateDirectoryName(request.name);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    if (request.name !== directory.name) {
      const existingDir = await findDirectoryByNameAndParent(
        userId,
        request.name,
        directory.parentId,
      );
      if (existingDir && existingDir.id !== directoryId) {
        throw new Error('Directory with this name already exists at this level');
      }
    }
  }

  const updateData: Partial<Directory> = {};
  if (request.name) {
    updateData.name = request.name;
    if (directory.parentId) {
      const parent = await fetchDirectoryFromFirestore(userId, directory.parentId);
      if (parent) {
        updateData.path = `${parent.path}/${request.name}`;
      }
    } else {
      updateData.path = `/${request.name}`;
    }
  }
  if (request.color !== undefined) updateData.color = request.color;
  if (request.icon !== undefined) updateData.icon = request.icon;
  if (request.description !== undefined) updateData.description = request.description;

  await updateDoc(directoryRef(userId, directoryId), {
    ...updateData,
    updatedAt: serverTimestamp(),
  });

  if (request.name && request.name !== directory.name && updateData.path) {
    await updateDescendantPaths(userId, directoryId, updateData.path);
  }

  await syncIndexSafely('updateDirectory', () =>
    syncSubdirectoryDirectoryIndex(userId, directoryId),
  );

  const updated = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!updated) {
    throw new Error('Directory not found after update');
  }
  return updated;
}

async function deleteCollectionByDirectoryId(
  userId: string,
  collectionName: string,
  directoryId: string,
  pageLimit: number,
): Promise<number> {
  const docs = await fetchAllUserDocsPaginated(
    userId,
    collectionName,
    [where('directoryId', '==', directoryId)],
    pageLimit,
  );
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
  return docs.length;
}

export async function deleteDirectoryInFirestore(
  userId: string,
  directoryId: string,
): Promise<DeleteDirectoryResponse> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    throw new Error('Directory not found');
  }

  const descendants = await getDescendants(userId, directoryId);
  const allDirectoryIds = [directoryId, ...descendants.map((d) => d.id)];

  await syncIndexSafely('deleteDirectory.items', async () => {
    await deleteDirectoryItemsForDirectories(userId, allDirectoryIds);
  });
  await syncIndexSafely('deleteDirectory.parentLink', () =>
    removeSubdirectoryDirectoryIndex(userId, directory.parentId, directoryId),
  );

  let deletedDocumentCount = 0;
  let deletedQuizCount = 0;
  let deletedFlashcardSetCount = 0;
  let deletedSlideDeckCount = 0;
  let deletedDiagramQuizCount = 0;

  for (const dirId of allDirectoryIds) {
    const docRefs = await fetchAllUserDocsPaginated(
      userId,
      'documents',
      [where('directoryId', '==', dirId)],
      FIRESTORE_DOCUMENTS_LIST_LIMIT,
    );
    deletedDocumentCount += docRefs.length;
    for (const docSnap of docRefs) {
      try {
        await deleteDocumentInFirestore(userId, docSnap.id);
      } catch (error) {
        console.warn('Failed to delete document during directory deletion', {
          documentId: docSnap.id,
          error,
        });
      }
    }

    deletedQuizCount += await deleteCollectionByDirectoryId(
      userId,
      'quizzes',
      dirId,
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );
    deletedFlashcardSetCount += await deleteCollectionByDirectoryId(
      userId,
      'flashcardSets',
      dirId,
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );

    const slideDeckRefs = await fetchAllUserDocsPaginated(
      userId,
      'slideDecks',
      [where('directoryId', '==', dirId)],
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );
    deletedSlideDeckCount += slideDeckRefs.length;
    for (const deckDoc of slideDeckRefs) {
      try {
        await deleteSlideDeckInFirestore(userId, deckDoc.id);
      } catch {
        await deleteDoc(deckDoc.ref);
      }
    }

    deletedDiagramQuizCount += await deleteCollectionByDirectoryId(
      userId,
      'diagramQuizzes',
      dirId,
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );
    await deleteCollectionByDirectoryId(
      userId,
      'sequenceQuizzes',
      dirId,
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );
    await deleteCollectionByDirectoryId(
      userId,
      'matchQuizzes',
      dirId,
      FIRESTORE_ARTIFACTS_LIST_LIMIT,
    );
  }

  for (let i = 0; i < allDirectoryIds.length; i += 500) {
    const chunk = allDirectoryIds.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach((dirId) => batch.delete(directoryRef(userId, dirId)));
    await batch.commit();
  }

  if (directory.parentId) {
    await updateDoc(directoryRef(userId, directory.parentId), {
      childCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }

  return {
    success: true,
    deletedDocumentCount,
    deletedDirectoryCount: allDirectoryIds.length,
    deletedQuizCount,
    deletedFlashcardSetCount,
    deletedSlideDeckCount,
    deletedDiagramQuizCount,
  };
}

export async function moveDirectoryInFirestore(
  userId: string,
  directoryId: string,
  request: MoveDirectoryRequest,
): Promise<MoveDirectoryResponse> {
  const directory = await fetchDirectoryFromFirestore(userId, directoryId);
  if (!directory) {
    throw new Error('Directory not found');
  }

  if (request.targetParentId) {
    const targetParent = await fetchDirectoryFromFirestore(userId, request.targetParentId);
    if (!targetParent) {
      throw new Error('Target parent directory not found');
    }
    if (await isDescendant(userId, request.targetParentId, directoryId)) {
      throw new Error('Cannot move directory to its own descendant');
    }
    const descendants = await getDescendants(userId, directoryId);
    const maxRelativeDepth = descendants.reduce((maxDepth, descendant) => {
      const relative = descendant.level - directory.level;
      return relative > maxDepth ? relative : maxDepth;
    }, 0);
    if (targetParent.level + 1 + maxRelativeDepth > DIRECTORY_CONSTRAINTS.MAX_DEPTH) {
      throw new Error('Target location exceeds maximum directory depth');
    }
  }

  const conflict = await findDirectoryByNameAndParent(
    userId,
    directory.name,
    request.targetParentId ?? null,
  );
  if (conflict && conflict.id !== directoryId) {
    throw new Error('A directory with this name already exists at the target location');
  }

  let newPath: string;
  let newLevel: number;
  if (request.targetParentId) {
    const targetParent = await fetchDirectoryFromFirestore(userId, request.targetParentId);
    if (!targetParent) {
      throw new Error('Target parent directory not found');
    }
    newPath = `${targetParent.path}/${directory.name}`;
    newLevel = targetParent.level + 1;
  } else {
    newPath = `/${directory.name}`;
    newLevel = 0;
  }

  if (directory.parentId) {
    await updateDoc(directoryRef(userId, directory.parentId), {
      childCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }
  if (request.targetParentId) {
    await updateDoc(directoryRef(userId, request.targetParentId), {
      childCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(directoryRef(userId, directoryId), {
    parentId: request.targetParentId ?? null,
    path: newPath,
    level: newLevel,
    updatedAt: serverTimestamp(),
  });

  const affectedDescendants = await updateDescendantPaths(userId, directoryId, newPath);

  await recalculateStatsForDirectoryMove(
    userId,
    directoryId,
    directory.parentId,
    request.targetParentId ?? null,
  );

  await syncIndexSafely('moveDirectory', () =>
    moveSubdirectoryDirectoryIndex(
      userId,
      directoryId,
      directory.parentId,
      request.targetParentId ?? null,
    ),
  );

  return {
    directory: {
      ...directory,
      parentId: request.targetParentId ?? null,
      path: newPath,
      level: newLevel,
      updatedAt: new Date(),
    },
    affectedDescendants,
  };
}

export async function getDirectoryByPathFromFirestore(
  userId: string,
  path: string,
): Promise<Directory | null> {
  const snapshot = await getDocs(
    query(userCollection(userId, 'directories'), where('path', '==', path), limit(1)),
  );
  if (snapshot.empty) {
    return null;
  }
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Directory;
}
