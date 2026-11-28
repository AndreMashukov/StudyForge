import {
  Timestamp,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { librarySearchRecordSchema } from '@shared-types';
import { searchRecordsCollection } from '../firestorePaths';
import type { ILocalSearchRecord } from './searchTypes';

/** Stays within the `isBoundedList(100)` security rule. */
const PAGE_SIZE = 40;

/**
 * Records are stamped with the server commit time, so one that commits just
 * after a sync can carry a time slightly before that sync's cursor. Reading a
 * little before the cursor picks those up; re-applying a record is harmless.
 */
const CURSOR_OVERLAP_MS = 60_000;

export interface ISearchRecordChanges {
  /** Current state of every changed record that still exists. */
  upserts: ILocalSearchRecord[];
  /** Records whose item was deleted. */
  removedIds: string[];
  /** Newest `updatedAt` seen, in milliseconds; null when nothing came back. */
  cursorMillis: number | null;
}

/** `sinceMillis: null` asks for everything (a full sync). */
export type FetchSearchRecordChanges = (
  userId: string,
  sinceMillis: number | null,
) => Promise<ISearchRecordChanges>;

function readMillis(value: unknown): number | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
}

export const fetchSearchRecordChanges: FetchSearchRecordChanges = async (
  userId,
  sinceMillis,
) => {
  const changed = new Map<string, ILocalSearchRecord | null>();
  let cursorMillis: number | null = null;
  let last: QueryDocumentSnapshot<DocumentData> | undefined;

  for (;;) {
    const constraints: QueryConstraint[] = [];
    if (sinceMillis !== null) {
      constraints.push(
        where(
          'updatedAt',
          '>',
          Timestamp.fromMillis(Math.max(0, sinceMillis - CURSOR_OVERLAP_MS)),
        ),
      );
    }
    constraints.push(orderBy('updatedAt'));
    if (last) constraints.push(startAfter(last));
    constraints.push(limit(PAGE_SIZE));

    // Always from the server: a cached page would hide newer changes.
    const snapshot = await getDocsFromServer(
      query(searchRecordsCollection(userId), ...constraints),
    );

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const updatedAt = readMillis(data.updatedAt);
      if (updatedAt !== null) {
        cursorMillis = Math.max(cursorMillis ?? 0, updatedAt);
      }
      const parsed = librarySearchRecordSchema.safeParse(data);
      if (!parsed.success) continue;

      const record = parsed.data;
      if (record.deleted) {
        changed.set(doc.id, null);
        continue;
      }
      const local: ILocalSearchRecord = {
        id: doc.id,
        itemType: record.itemType,
        sourceId: record.sourceId,
        directoryId: record.directoryId,
        title: record.title,
      };
      if (record.description) local.description = record.description;
      if (record.tags) local.tags = record.tags;
      if (record.text) local.text = record.text;
      if (record.generationStatus) {
        local.generationStatus = record.generationStatus;
      }
      if (record.lastActivityAt !== undefined) {
        local.lastActivityAt = record.lastActivityAt;
      }
      changed.set(doc.id, local);
    }

    if (snapshot.size < PAGE_SIZE) break;
    last = snapshot.docs[snapshot.docs.length - 1];
  }

  const upserts: ILocalSearchRecord[] = [];
  const removedIds: string[] = [];
  for (const [id, record] of changed) {
    if (record) upserts.push(record);
    else removedIds.push(id);
  }
  return { upserts, removedIds, cursorMillis };
};
