import {
  addDoc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  CreateDirectoryRequest,
  Directory,
  DirectoryValidationResult,
} from '@shared-types';
import { DIRECTORY_CONSTRAINTS } from '@shared-types';
import { directoryRef, userCollection } from './firestorePaths';
import {
  syncIndexSafely,
  syncSubdirectoryDirectoryIndex,
} from './directoryItemIndexMutations';

export function validateDirectoryName(name: string): DirectoryValidationResult {
  const errors: string[] = [];
  if (!name || name.trim().length === 0) {
    errors.push('Directory name is required');
  }
  if (name.length > DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH) {
    errors.push(
      `Directory name must not exceed ${DIRECTORY_CONSTRAINTS.MAX_NAME_LENGTH} characters`,
    );
  }
  const reservedNames: readonly string[] = DIRECTORY_CONSTRAINTS.RESERVED_NAMES;
  if (reservedNames.includes(name.toLowerCase())) {
    errors.push('Directory name is reserved');
  }
  if (/[/\\:*?"<>|]/.test(name)) {
    errors.push('Directory name contains invalid characters');
  }
  return { isValid: errors.length === 0, errors };
}

interface IParentDirectory {
  id: string;
  path: string;
  level: number;
}

async function readParentDirectory(
  userId: string,
  directoryId: string,
): Promise<IParentDirectory | null> {
  const snapshot = await getDoc(directoryRef(userId, directoryId));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  const path = typeof data.path === 'string' ? data.path : null;
  const level = typeof data.level === 'number' ? data.level : null;
  return path !== null && level !== null
    ? { id: snapshot.id, path, level }
    : null;
}

async function directoryNameTaken(
  userId: string,
  name: string,
  parentId: string | null,
): Promise<boolean> {
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'directories'),
      where('name', '==', name),
      where('parentId', '==', parentId),
      limit(1),
    ),
  );
  return !snapshot.empty;
}

/** Create a directory (and its parent's subdirectory index row) with the signed-in user's client SDK. */
export async function createDirectoryInFirestore(
  userId: string,
  request: CreateDirectoryRequest,
): Promise<Directory> {
  const validation = validateDirectoryName(request.name);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  let parentDirectory: IParentDirectory | null = null;
  let level = 0;
  let path = `/${request.name}`;

  if (request.parentId) {
    parentDirectory = await readParentDirectory(userId, request.parentId);
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

  if (
    await directoryNameTaken(userId, request.name, request.parentId ?? null)
  ) {
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
    ...(request.description !== undefined
      ? { description: request.description }
      : {}),
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
