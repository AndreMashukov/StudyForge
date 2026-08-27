import { deleteObject, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  deleteDoc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type {
  DocumentEnhanced,
  GenerationStatus,
  MoveDocumentRequest,
  UpdateDocumentRequest,
} from '@shared-types';
import { storage } from '../config/firebase';
import { fetchDocumentFromFirestore } from './documentFirestore';
import {
  getDocumentHtmlStoragePath,
  getDocumentMarkdownStoragePath,
} from './documentContentStorage';
import { directoryRef, documentRef } from './firestorePaths';
import {
  documentToDirectoryItem,
  moveDirectoryItem,
  removeDirectoryItem,
  syncDocumentDirectoryIndex,
  syncIndexSafely,
} from './directoryItemIndexMutations';
import { deleteArtifactsByDocumentId } from './artifactMutations';
import { fetchDirectoryFromFirestore } from './directoryFirestore';

function countWords(content: string): number {
  const text = content.replace(/<[^>]+>/g, ' ').trim();
  if (!text) {
    return 0;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

function shouldDecrementDocumentCount(generationStatus: GenerationStatus | undefined): boolean {
  return !generationStatus || generationStatus === 'completed';
}

async function deleteDocumentStorage(
  userId: string,
  documentId: string,
  contentFormat?: string,
): Promise<void> {
  const paths = contentFormat === 'markdown'
    ? [getDocumentMarkdownStoragePath(userId, documentId)]
    : [
        getDocumentHtmlStoragePath(userId, documentId),
        getDocumentMarkdownStoragePath(userId, documentId),
      ];

  for (const path of paths) {
    try {
      await deleteObject(ref(storage, path));
    } catch {
      /* file may not exist */
    }
  }
}

export async function updateDocumentInFirestore(
  userId: string,
  documentId: string,
  updates: UpdateDocumentRequest,
): Promise<DocumentEnhanced> {
  const current = await fetchDocumentFromFirestore(userId, documentId);
  if (!current) {
    throw new Error('Document not found');
  }

  const contentFormat = current.contentFormat ?? 'html';
  const firestoreUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.title !== undefined) firestoreUpdates.title = updates.title;
  if (updates.description !== undefined) firestoreUpdates.description = updates.description;
  if (updates.tags !== undefined) firestoreUpdates.tags = updates.tags;
  if (updates.status !== undefined) firestoreUpdates.status = updates.status;

  if (updates.content !== undefined) {
    if (contentFormat === 'markdown') {
      throw new Error('Legacy markdown documents are read-only and cannot be edited.');
    }
    const htmlPath = getDocumentHtmlStoragePath(userId, documentId);
    const blob = new Blob([updates.content], { type: 'text/html' });
    await uploadBytes(ref(storage, htmlPath), blob, { contentType: 'text/html' });
    const downloadUrl = await getDownloadURL(ref(storage, htmlPath));
    firestoreUpdates.storageUrl = downloadUrl;
    firestoreUpdates.wordCount = countWords(updates.content);
  }

  await updateDoc(documentRef(userId, documentId), firestoreUpdates);
  await syncIndexSafely('updateDocument', () =>
    syncDocumentDirectoryIndex(userId, documentId),
  );

  const updated = await fetchDocumentFromFirestore(userId, documentId);
  if (!updated) {
    throw new Error('Document not found after update');
  }
  return updated;
}

export async function deleteDocumentInFirestore(
  userId: string,
  documentId: string,
): Promise<void> {
  const document = await fetchDocumentFromFirestore(userId, documentId);
  if (!document) {
    throw new Error('Document not found');
  }

  await deleteArtifactsByDocumentId(userId, documentId);
  await deleteDocumentStorage(userId, documentId, document.contentFormat);

  if (document.directoryId) {
    await syncIndexSafely('deleteDocument', () =>
      removeDirectoryItem(userId, document.directoryId as string, 'document', documentId),
    );
  }

  if (document.directoryId && shouldDecrementDocumentCount(document.generationStatus)) {
    try {
      await updateDoc(directoryRef(userId, document.directoryId), {
        documentCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      /* ignore count drift */
    }
  }

  await deleteDoc(documentRef(userId, documentId));
}

export async function moveDocumentInFirestore(
  userId: string,
  documentId: string,
  request: MoveDocumentRequest,
): Promise<DocumentEnhanced> {
  if (!request.targetDirectoryId) {
    throw new Error('targetDirectoryId is required');
  }

  const targetDir = await fetchDirectoryFromFirestore(userId, request.targetDirectoryId);
  if (!targetDir) {
    throw new Error(`Directory ${request.targetDirectoryId} does not exist.`);
  }

  const current = await fetchDocumentFromFirestore(userId, documentId);
  if (!current) {
    throw new Error('Document not found');
  }

  const oldDirectoryId = current.directoryId;
  const countsDocument = shouldDecrementDocumentCount(current.generationStatus);

  if (oldDirectoryId && countsDocument) {
    await updateDoc(directoryRef(userId, oldDirectoryId), {
      documentCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(documentRef(userId, documentId), {
    directoryId: request.targetDirectoryId,
    updatedAt: serverTimestamp(),
  });

  if (countsDocument) {
    await updateDoc(directoryRef(userId, request.targetDirectoryId), {
      documentCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  const updatedSnap = await getDoc(documentRef(userId, documentId));
  const item = documentToDirectoryItem(documentId, updatedSnap.data() ?? {});

  if (oldDirectoryId && item) {
    await syncIndexSafely('moveDocument', () =>
      moveDirectoryItem(userId, oldDirectoryId, request.targetDirectoryId, item),
    );
  } else {
    await syncIndexSafely('moveDocument', () =>
      syncDocumentDirectoryIndex(userId, documentId),
    );
  }

  const updated = await fetchDocumentFromFirestore(userId, documentId);
  if (!updated) {
    throw new Error('Document not found after move');
  }
  return updated;
}
