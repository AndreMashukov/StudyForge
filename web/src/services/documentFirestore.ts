import type { DocumentEnhanced } from '@shared-types';
import {
  fetchUserCollection,
  fetchUserDoc,
  orderByCreatedAtDesc,
  whereEquals,
} from './firestoreReadUtils';

const DEFAULT_USER_DOCUMENTS_LIMIT = 100;

export function fetchDocumentFromFirestore(
  userId: string,
  documentId: string,
): Promise<DocumentEnhanced | null> {
  return fetchUserDoc<DocumentEnhanced>(userId, 'documents', documentId);
}

export function fetchUserDocumentsFromFirestore(
  userId: string,
  options?: { limit?: number; directoryId?: string },
): Promise<DocumentEnhanced[]> {
  const limitCount = options?.limit ?? DEFAULT_USER_DOCUMENTS_LIMIT;
  const constraints = options?.directoryId
    ? [whereEquals('directoryId', options.directoryId), ...orderByCreatedAtDesc(limitCount)]
    : orderByCreatedAtDesc(limitCount);

  return fetchUserCollection<DocumentEnhanced>(userId, 'documents', constraints);
}
