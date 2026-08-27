import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
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

export function customError(message: string) {
  return {
    error: {
      status: 'CUSTOM_ERROR' as const,
      data: { message },
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

export const FIRESTORE_DOCUMENTS_LIST_LIMIT = 100;
export const FIRESTORE_ARTIFACTS_LIST_LIMIT = 50;

export async function fetchAllUserDocsPaginated(
  userId: string,
  collectionName: string,
  filters: QueryConstraint[],
  pageLimit: number,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const collectionRef = collection(db, 'users', userId, collectionName);
  const results: QueryDocumentSnapshot<DocumentData>[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const constraints: QueryConstraint[] = [...filters, orderBy(documentId())];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(pageLimit));

    const snapshot = await getDocs(query(collectionRef, ...constraints));
    results.push(...snapshot.docs);
    if (snapshot.size < pageLimit) {
      break;
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return results;
}

export function subscribeWithReconnect(
  connect: (onError: (error: Error) => void) => Unsubscribe,
): Unsubscribe {
  let stopped = false;
  let current: Unsubscribe | undefined;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    if (stopped) {
      return;
    }
    current = connect(() => {
      current?.();
      current = undefined;
      if (stopped) {
        return;
      }
      attempt += 1;
      const delayMs = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      retryTimer = setTimeout(start, delayMs);
    });
  };

  start();

  return () => {
    stopped = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    current?.();
  };
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
      // Listener errors surface on RTK refetch; no callable fallback.
    },
  );
}
