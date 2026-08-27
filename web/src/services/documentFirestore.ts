import type { DocumentEnhanced } from '@shared-types';
import {
  fetchUserDoc,
  toFirestoreDoc,
  whereEquals,
} from './firestoreReadUtils';
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const DEFAULT_USER_DOCUMENTS_LIMIT = 100;
const MAX_DOCUMENTS_QUERY_LIMIT = 100;
const CURSOR_VERSION = 1;
const DOCUMENT_LIST_SORT = { sortBy: 'createdAt', sortOrder: 'desc' as const };

type EncodedSortValue = string | number | { _type: 'timestamp'; seconds: number; nanoseconds: number };

interface EncodedCursorPayload {
  v: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  sortValue: EncodedSortValue;
  id: string;
}

function serializeSortValue(value: unknown): EncodedSortValue {
  if (value instanceof Timestamp) {
    return { _type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    const timestampLike = value as { seconds: number; nanoseconds: number };
    return {
      _type: 'timestamp',
      seconds: timestampLike.seconds,
      nanoseconds: timestampLike.nanoseconds,
    };
  }
  throw new Error('Unsupported sort field value for cursor');
}

function deserializeSortValue(value: EncodedSortValue): string | number | Timestamp {
  if (
    typeof value === 'object'
    && value !== null
    && value._type === 'timestamp'
  ) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  return value as string | number;
}

function encodeDocumentCursor(sortValue: unknown, docId: string): string {
  const payload: EncodedCursorPayload = {
    v: CURSOR_VERSION,
    ...DOCUMENT_LIST_SORT,
    sortValue: serializeSortValue(sortValue),
    id: docId,
  };
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeDocumentCursor(cursor: string): {
  sortValue: string | number | Timestamp;
  id: string;
} {
  const json = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
  const payload = JSON.parse(json) as EncodedCursorPayload;
  if (payload.v !== CURSOR_VERSION) {
    throw new Error('Unsupported cursor version');
  }
  if (
    payload.sortBy !== DOCUMENT_LIST_SORT.sortBy
    || payload.sortOrder !== DOCUMENT_LIST_SORT.sortOrder
  ) {
    throw new Error('Cursor does not match requested sort options');
  }
  const sortValue = deserializeSortValue(payload.sortValue);
  return {
    sortValue,
    id: payload.id,
  };
}

export interface IFirestoreDocumentPage {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface IFetchUserDocumentsOptions {
  limit?: number;
  directoryId?: string;
  cursor?: string;
}

export function fetchDocumentFromFirestore(
  userId: string,
  documentId: string,
): Promise<DocumentEnhanced | null> {
  return fetchUserDoc<DocumentEnhanced>(userId, 'documents', documentId);
}

async function countMatchingDocuments(
  collectionRef: ReturnType<typeof collection>,
  filters: QueryConstraint[],
): Promise<number> {
  let total = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const constraints: QueryConstraint[] = [
      ...filters,
      orderBy(DOCUMENT_LIST_SORT.sortBy, DOCUMENT_LIST_SORT.sortOrder),
      orderBy(documentId(), DOCUMENT_LIST_SORT.sortOrder),
    ];
    if (lastDoc) {
      constraints.push(
        startAfter(lastDoc.data()[DOCUMENT_LIST_SORT.sortBy], lastDoc.id),
      );
    }
    constraints.push(limit(MAX_DOCUMENTS_QUERY_LIMIT));

    const snapshot = await getDocs(query(collectionRef, ...constraints));
    total += snapshot.size;
    if (snapshot.size < MAX_DOCUMENTS_QUERY_LIMIT) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return total;
}

export async function fetchUserDocumentsFromFirestore(
  userId: string,
  options: IFetchUserDocumentsOptions = {},
): Promise<IFirestoreDocumentPage> {
  const requestedLimit = options.limit ?? DEFAULT_USER_DOCUMENTS_LIMIT;
  const pageSize = Math.min(requestedLimit, MAX_DOCUMENTS_QUERY_LIMIT);
  const collectionRef = collection(db, 'users', userId, 'documents');

  const filters = options.directoryId
    ? [whereEquals('directoryId', options.directoryId)]
    : [];

  const total = await countMatchingDocuments(collectionRef, filters);

  const constraints = [
    ...filters,
    orderBy(DOCUMENT_LIST_SORT.sortBy, DOCUMENT_LIST_SORT.sortOrder),
    orderBy(documentId(), DOCUMENT_LIST_SORT.sortOrder),
  ];

  if (options.cursor) {
    const decoded = decodeDocumentCursor(options.cursor);
    constraints.push(startAfter(decoded.sortValue, decoded.id));
  }

  constraints.push(limit(pageSize + 1));

  const snapshot = await getDocs(query(collectionRef, ...constraints));
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocuments = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const lastDoc = pageDocuments[pageDocuments.length - 1];

  return {
    documents: pageDocuments.map((document) =>
      toFirestoreDoc<DocumentEnhanced>(document.id, document.data()),
    ),
    total,
    hasMore,
    nextCursor:
      hasMore && lastDoc
        ? encodeDocumentCursor(lastDoc.data()[DOCUMENT_LIST_SORT.sortBy], lastDoc.id)
        : undefined,
  };
}
