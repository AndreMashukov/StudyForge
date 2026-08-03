import type { DocumentEnhanced } from '@shared-types';
import {
  fetchUserDoc,
  toFirestoreDoc,
  whereEquals,
} from './firestoreReadUtils';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULT_USER_DOCUMENTS_LIMIT = 100;
const MAX_DOCUMENTS_QUERY_LIMIT = 100;

export interface IFirestoreDocumentPage {
  documents: DocumentEnhanced[];
  hasMore: boolean;
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface IFetchUserDocumentsOptions {
  limit?: number;
  directoryId?: string;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

export function fetchDocumentFromFirestore(
  userId: string,
  documentId: string,
): Promise<DocumentEnhanced | null> {
  return fetchUserDoc<DocumentEnhanced>(userId, 'documents', documentId);
}

export function fetchUserDocumentsFromFirestore(
  userId: string,
  options: IFetchUserDocumentsOptions = {},
): Promise<IFirestoreDocumentPage> {
  const requestedLimit = options.limit ?? DEFAULT_USER_DOCUMENTS_LIMIT;
  const pageSize = Math.min(requestedLimit, MAX_DOCUMENTS_QUERY_LIMIT - 1);
  const constraints = [
    ...(options.directoryId
      ? [whereEquals('directoryId', options.directoryId)]
      : []),
    orderBy('createdAt', 'desc'),
    ...(options.cursor ? [startAfter(options.cursor)] : []),
    limit(pageSize + 1),
  ];
  const collectionRef = collection(db, 'users', userId, 'documents');

  return getDocs(query(collectionRef, ...constraints)).then((snapshot) => {
    const hasMore = snapshot.docs.length > pageSize;
    const pageDocuments = hasMore
      ? snapshot.docs.slice(0, pageSize)
      : snapshot.docs;

    return {
      documents: pageDocuments.map((document) =>
        toFirestoreDoc<DocumentEnhanced>(document.id, document.data()),
      ),
      hasMore,
      nextCursor: hasMore ? pageDocuments[pageDocuments.length - 1] : undefined,
    };
  });
}
