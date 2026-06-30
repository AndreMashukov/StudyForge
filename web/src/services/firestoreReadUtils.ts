import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { serializeCommonTimestamps } from '../hooks/directoryRealtimeCacheUtils';

export function authRequiredError() {
  return {
    error: {
      status: 'CUSTOM_ERROR' as const,
      data: { message: 'Authentication required' },
    },
  };
}

export function notFoundError(message = 'Not found') {
  return {
    error: {
      status: 'CUSTOM_ERROR' as const,
      data: { message, code: 'NOT_FOUND' },
    },
  };
}

export function toFirestoreDoc<T extends { id: string }>(id: string, raw: DocumentData): T {
  return {
    id,
    ...serializeCommonTimestamps(raw),
  } as T;
}

export async function fetchUserDoc<T extends { id: string }>(
  userId: string,
  collectionName: string,
  docId: string,
): Promise<T | null> {
  const snapshot = await getDoc(doc(db, 'users', userId, collectionName, docId));
  if (!snapshot.exists()) {
    return null;
  }
  return toFirestoreDoc<T>(snapshot.id, snapshot.data());
}

export async function fetchUserCollection<T extends { id: string }>(
  userId: string,
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const collectionRef = collection(db, 'users', userId, collectionName);
  const snapshot = await getDocs(query(collectionRef, ...constraints));
  return snapshot.docs.map((document) => toFirestoreDoc<T>(document.id, document.data()));
}

export function orderByCreatedAtDesc(limitCount?: number): QueryConstraint[] {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (limitCount !== undefined) {
    constraints.push(limit(limitCount));
  }
  return constraints;
}

export function whereEquals(field: string, value: string): QueryConstraint {
  return where(field, '==', value);
}

export function subscribeToUserDoc(
  userId: string,
  collectionName: string,
  docId: string,
  onUpdate: (raw: DocumentData | null, docId: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', userId, collectionName, docId),
    (snapshot) => {
      onUpdate(snapshot.exists() ? snapshot.data() : null, snapshot.id);
    },
    () => {
      // Listener errors are handled by RTK queryFn callable fallback on refetch.
    },
  );
}
