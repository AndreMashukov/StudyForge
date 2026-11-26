/**
 * Display order for the items inside a directory, shared by the web app, the
 * mobile app and the backend so every view lists them the same way.
 *
 * - Documents: the user's drag order when any document has one (ordered
 *   documents first, lowest first), then the rest newest first.
 * - Artifacts: one list of every type, newest first. Artifacts have no manual
 *   order; a stored `sortOrder` on an artifact is ignored.
 */
export interface IOrderableDirectoryItem {
  id: string;
  createdAt: unknown;
  sortOrder?: number;
}

function hasSortOrder(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Milliseconds for a stored time: a Date, an ISO string, epoch millis, a
 * Firestore Timestamp (client or admin) or its plain `{ seconds }` form.
 * Unreadable values count as 0, so they sort as oldest.
 */
export function directoryTimeToMillis(value: unknown): number {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  if (isRecord(value)) {
    const { toMillis, toDate, seconds, _seconds } = value;
    if (typeof toMillis === 'function') {
      const time: unknown = toMillis.call(value);
      return typeof time === 'number' && Number.isFinite(time) ? time : 0;
    }
    if (typeof toDate === 'function') {
      const date: unknown = toDate.call(value);
      return date instanceof Date ? directoryTimeToMillis(date) : 0;
    }
    const plainSeconds =
      typeof seconds === 'number' ? seconds : typeof _seconds === 'number' ? _seconds : null;
    if (plainSeconds !== null && Number.isFinite(plainSeconds)) {
      return plainSeconds * 1000;
    }
  }
  return 0;
}

function compareNewestFirst(
  left: IOrderableDirectoryItem,
  right: IOrderableDirectoryItem,
): number {
  return (
    directoryTimeToMillis(right.createdAt) -
      directoryTimeToMillis(left.createdAt) || left.id.localeCompare(right.id)
  );
}

/** True when any of these documents has a manual position. */
export function hasManualItemOrder(
  items: readonly IOrderableDirectoryItem[],
): boolean {
  return items.some((item) => hasSortOrder(item.sortOrder));
}

/**
 * Compares two documents of the same directory. Pass `hasManualOrder` from
 * {@link hasManualItemOrder} over the whole list.
 */
export function compareDocumentOrder(
  left: IOrderableDirectoryItem,
  right: IOrderableDirectoryItem,
  hasManualOrder: boolean,
): number {
  if (hasManualOrder) {
    const leftOrdered = hasSortOrder(left.sortOrder);
    const rightOrdered = hasSortOrder(right.sortOrder);
    if (leftOrdered && rightOrdered && left.sortOrder !== right.sortOrder) {
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    }
    if (leftOrdered !== rightOrdered) {
      return leftOrdered ? -1 : 1;
    }
  }
  return compareNewestFirst(left, right);
}

/** Returns a sorted copy of a directory's documents in display order. */
export function sortDocumentsForDisplay<T extends IOrderableDirectoryItem>(
  documents: readonly T[],
): T[] {
  const manual = hasManualItemOrder(documents);
  return [...documents].sort((left, right) =>
    compareDocumentOrder(left, right, manual),
  );
}

/** Compares two artifacts (any types): newest first. */
export function compareArtifactOrder(
  left: IOrderableDirectoryItem,
  right: IOrderableDirectoryItem,
): number {
  return compareNewestFirst(left, right);
}

/** Returns a sorted copy of a directory's artifacts, all types mixed, newest first. */
export function sortArtifactsForDisplay<T extends IOrderableDirectoryItem>(
  artifacts: readonly T[],
): T[] {
  return [...artifacts].sort(compareArtifactOrder);
}
