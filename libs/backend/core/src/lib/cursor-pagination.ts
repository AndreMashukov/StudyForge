import { FieldPath, Timestamp, type Query } from 'firebase-admin/firestore';

const CURSOR_VERSION = 1;

export type SortOrder = 'asc' | 'desc';

export interface CursorSortConfig {
  sortBy: string;
  sortOrder: SortOrder;
}

interface SerializedTimestamp {
  _type: 'timestamp';
  seconds: number;
  nanoseconds: number;
}

type EncodedSortValue = string | number | SerializedTimestamp;

interface EncodedCursorPayload {
  v: number;
  sortBy: string;
  sortOrder: SortOrder;
  sortValue: EncodedSortValue;
  id: string;
}

export class CursorPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CursorPaginationError';
  }
}

function isSerializedTimestamp(value: EncodedSortValue): value is SerializedTimestamp {
  return (
    typeof value === 'object'
    && value !== null
    && value._type === 'timestamp'
    && typeof value.seconds === 'number'
    && typeof value.nanoseconds === 'number'
  );
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
  throw new CursorPaginationError('Unsupported sort field value for cursor');
}

function deserializeSortValue(value: EncodedSortValue): string | number | Timestamp {
  if (isSerializedTimestamp(value)) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  return value;
}

export function encodeCursor(
  config: CursorSortConfig,
  sortValue: unknown,
  documentId: string,
): string {
  const payload: EncodedCursorPayload = {
    v: CURSOR_VERSION,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    sortValue: serializeSortValue(sortValue),
    id: documentId,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string,
  expected: CursorSortConfig,
): { sortValue: string | number | Timestamp; id: string } {
  let payload: EncodedCursorPayload;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    payload = JSON.parse(json) as EncodedCursorPayload;
  } catch {
    throw new CursorPaginationError('Invalid cursor');
  }

  if (payload.v !== CURSOR_VERSION) {
    throw new CursorPaginationError('Unsupported cursor version');
  }
  if (payload.sortBy !== expected.sortBy || payload.sortOrder !== expected.sortOrder) {
    throw new CursorPaginationError('Cursor does not match requested sort options');
  }
  if (!payload.id || typeof payload.id !== 'string') {
    throw new CursorPaginationError('Invalid cursor document id');
  }

  return {
    sortValue: deserializeSortValue(payload.sortValue),
    id: payload.id,
  };
}

export function applyOrderedQueryWithCursor(
  query: Query,
  config: CursorSortConfig,
  cursor?: string,
): Query {
  let ordered = query
    .orderBy(config.sortBy, config.sortOrder)
    .orderBy(FieldPath.documentId(), config.sortOrder);

  if (cursor) {
    const decoded = decodeCursor(cursor, config);
    ordered = ordered.startAfter(decoded.sortValue, decoded.id);
  }

  return ordered;
}

export function resolvePageLimit(
  limit: number | undefined,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): number {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  if (limit === undefined) {
    return defaultLimit;
  }

  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
    throw new CursorPaginationError('Limit must be a positive integer');
  }

  return Math.min(limit, maxLimit);
}

export function trimPage<T>(items: T[], limit: number): { page: T[]; hasMore: boolean } {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { page, hasMore };
}

export function buildNextCursor<T extends { id: string }>(
  items: T[],
  hasMore: boolean,
  config: CursorSortConfig,
  getSortValue: (item: T) => unknown,
): string | undefined {
  if (!hasMore || items.length === 0) {
    return undefined;
  }
  const last = items[items.length - 1];
  return encodeCursor(config, getSortValue(last), last.id);
}
