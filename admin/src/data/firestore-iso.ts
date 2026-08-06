import 'server-only';

export interface IFirestoreTimestampLike {
  toDate: () => Date;
}

export function isFirestoreTimestampLike(value: unknown): value is IFirestoreTimestampLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('toDate' in value)) {
    return false;
  }
  return typeof value.toDate === 'function';
}

/** Convert a Firestore Timestamp-like value or ISO string to an ISO string. */
export function toIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (isFirestoreTimestampLike(value)) {
    return value.toDate().toISOString();
  }

  return undefined;
}
