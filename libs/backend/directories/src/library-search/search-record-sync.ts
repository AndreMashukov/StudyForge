import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { LibrarySearchItemType, LibrarySearchRecord } from '@shared-types';
import {
  CHAT_SEARCH_TEXT_MAX_CHARS,
  buildSearchRecord,
  buildSearchRecordTombstone,
  capSearchText,
  htmlToSearchText,
  isDocumentTextExpected,
  isSearchSourceDeleted,
  joinChatSearchText,
  markdownToSearchText,
  type ISearchRecordText,
  type SearchSourceData,
} from './search-record-builders';

/**
 * Keeps one search record in step with its source item.
 *
 * Firestore and the Storage bucket are injected, and runtime imports stay
 * npm-only, so the backfill migration can run this file with plain `tsx`.
 */

const SOURCE_COLLECTIONS: Record<LibrarySearchItemType, string> = {
  directory: 'directories',
  document: 'documents',
  quiz: 'quizzes',
  flashcard: 'flashcardSets',
  slideDeck: 'slideDecks',
  diagramQuiz: 'diagramQuizzes',
  sequenceQuiz: 'sequenceQuizzes',
  matchQuiz: 'matchQuizzes',
  chat: 'agentThreads',
};

export const SEARCH_RECORD_ITEM_TYPES: LibrarySearchItemType[] = [
  'directory',
  'document',
  'quiz',
  'flashcard',
  'slideDeck',
  'diagramQuiz',
  'sequenceQuiz',
  'matchQuiz',
  'chat',
];

const SEARCH_RECORDS_COLLECTION = 'searchRecords';
/** Messages read per page while filling a chat's search text. */
const CHAT_MESSAGES_PAGE_SIZE = 50;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ISearchTextFile {
  getMetadata(): Promise<[{ md5Hash?: string }, ...unknown[]]>;
  download(): Promise<[Buffer]>;
}

export interface ISearchTextBucket {
  file(path: string): ISearchTextFile;
}

export interface ISearchRecordSyncDeps {
  db: FirebaseFirestore.Firestore;
  bucket: ISearchTextBucket;
  schemaVersion: number;
  tombstoneTtlDays: number;
}

export interface ISearchRecordTarget {
  userId: string;
  itemType: LibrarySearchItemType;
  sourceId: string;
}

export type SearchRecordSyncOutcome =
  /** Record created or replaced. */
  | 'written'
  /** Record already matches the source. */
  | 'unchanged'
  /** Source is gone; record turned into a tombstone. */
  | 'tombstoned'
  /** Source is gone and it never had a record. */
  | 'absent';

export function sourceCollectionName(itemType: LibrarySearchItemType): string {
  return SOURCE_COLLECTIONS[itemType];
}

function userDoc(db: FirebaseFirestore.Firestore, userId: string) {
  return db.collection('users').doc(userId);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 404
  );
}

function documentBodyPaths(
  userId: string,
  documentId: string,
  raw: SearchSourceData,
): string[] {
  // Same layout as buildDocumentHtmlStoragePath / buildDocumentMarkdownStoragePath.
  const base = `users/${userId}/documents/${documentId}`;
  const html = `${base}/content.html`;
  const markdown = `${base}/content.md`;
  const preferred =
    typeof raw.storagePath === 'string' && raw.storagePath.length > 0
      ? raw.storagePath
      : raw.contentFormat === 'html'
        ? html
        : markdown;
  return [...new Set([preferred, html, markdown])];
}

async function readDocumentText(
  deps: ISearchRecordSyncDeps,
  target: ISearchRecordTarget,
  raw: SearchSourceData,
  existing: FirebaseFirestore.DocumentData | undefined,
): Promise<ISearchRecordText | undefined> {
  if (!isDocumentTextExpected(raw)) {
    return undefined;
  }

  for (const path of documentBodyPaths(target.userId, target.sourceId, raw)) {
    const file = deps.bucket.file(path);
    let md5: string | undefined;
    try {
      const [metadata] = await file.getMetadata();
      md5 = metadata.md5Hash;
    } catch (error) {
      if (isNotFound(error)) {
        continue;
      }
      throw error;
    }

    // Same body and same extraction rules as last time: skip the download.
    if (
      md5 !== undefined &&
      existing?.deleted === false &&
      existing.sourceMd5 === md5 &&
      existing.schemaVersion === deps.schemaVersion
    ) {
      return {
        text: typeof existing.text === 'string' ? existing.text : '',
        truncated: existing.textTruncated === true,
        sourceMd5: md5,
      };
    }

    const [content] = await file.download();
    const body = content.toString('utf8');
    const plain = path.endsWith('.md')
      ? markdownToSearchText(body)
      : htmlToSearchText(body);
    const capped = capSearchText(plain);
    return { text: capped.text, truncated: capped.truncated, sourceMd5: md5 };
  }

  return undefined;
}

/**
 * Reads a chat's messages newest first, only as far back as the text cap
 * reaches, and joins them oldest first.
 */
async function readChatText(
  sourceRef: FirebaseFirestore.DocumentReference,
): Promise<ISearchRecordText> {
  const contents: string[] = [];
  let collected = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (collected <= CHAT_SEARCH_TEXT_MAX_CHARS) {
    let page: FirebaseFirestore.Query = sourceRef
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(CHAT_MESSAGES_PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();

    for (const doc of snapshot.docs) {
      const content = doc.get('content');
      if (typeof content === 'string') {
        // Same plain text the join produces, so the stop point is exact.
        const plain = markdownToSearchText(content);
        if (plain.length === 0) continue;
        contents.push(plain);
        collected += plain.length + 1;
      }
    }
    if (snapshot.docs.length < CHAT_MESSAGES_PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return joinChatSearchText(contents);
}

function recordsMatch(
  current: FirebaseFirestore.DocumentData | undefined,
  desired: LibrarySearchRecord,
): boolean {
  return (
    current !== undefined &&
    current.deleted === desired.deleted &&
    current.contentHash === desired.contentHash &&
    (current.sourceMd5 ?? null) === (desired.sourceMd5 ?? null)
  );
}

function sameVersion(
  left: FirebaseFirestore.DocumentSnapshot,
  right: FirebaseFirestore.DocumentSnapshot,
): boolean {
  if (left.exists !== right.exists) {
    return false;
  }
  if (!left.updateTime || !right.updateTime) {
    return left.updateTime === right.updateTime;
  }
  return left.updateTime.isEqual(right.updateTime);
}

/**
 * Rebuilds the record from the current source and writes it only when it
 * differs. Safe to call repeatedly and out of order: it always reads the
 * source again, and retries if the source changed while the body was read.
 */
export async function syncSearchRecord(
  deps: ISearchRecordSyncDeps,
  target: ISearchRecordTarget,
  options: { dryRun?: boolean } = {},
): Promise<SearchRecordSyncOutcome> {
  const user = userDoc(deps.db, target.userId);
  const sourceRef = user
    .collection(sourceCollectionName(target.itemType))
    .doc(target.sourceId);
  const recordRef = user
    .collection(SEARCH_RECORDS_COLLECTION)
    .doc(`${target.itemType}_${target.sourceId}`);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [sourceSnapshot, existingSnapshot] = await Promise.all([
      sourceRef.get(),
      recordRef.get(),
    ]);
    const raw = sourceSnapshot.data();
    const existing = existingSnapshot.data();
    const sourceGone =
      raw === undefined || isSearchSourceDeleted(target.itemType, raw);

    const desired = sourceGone
      ? buildSearchRecordTombstone(
          target.itemType,
          target.sourceId,
          deps.schemaVersion,
        )
      : buildSearchRecord(
          {
            itemType: target.itemType,
            sourceId: target.sourceId,
            raw,
            text:
              target.itemType === 'document'
                ? await readDocumentText(deps, target, raw, existing)
                : target.itemType === 'chat'
                  ? await readChatText(sourceRef)
                  : undefined,
          },
          deps.schemaVersion,
        );

    const decide = (
      current: FirebaseFirestore.DocumentData | undefined,
    ): SearchRecordSyncOutcome => {
      if (sourceGone) {
        if (current === undefined) return 'absent';
        return current.deleted === true ? 'unchanged' : 'tombstoned';
      }
      return recordsMatch(current, desired) ? 'unchanged' : 'written';
    };

    if (options.dryRun) {
      return decide(existing);
    }

    const outcome = await deps.db.runTransaction(
      async (transaction): Promise<SearchRecordSyncOutcome | 'retry'> => {
      const [freshSource, current] = await Promise.all([
        transaction.get(sourceRef),
        transaction.get(recordRef),
      ]);
      if (!sameVersion(sourceSnapshot, freshSource)) {
        return 'retry';
      }
      const result = decide(current.data());
      if (result === 'written') {
        transaction.set(recordRef, {
          ...desired,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (result === 'tombstoned') {
        transaction.set(recordRef, {
          ...desired,
          updatedAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(
            Date.now() + deps.tombstoneTtlDays * DAY_MS,
          ),
        });
      }
      return result;
      },
    );

    if (outcome !== 'retry') {
      return outcome;
    }
  }

  throw new Error(
    `Search record sync kept racing with writes: ${target.itemType}/${target.sourceId}`,
  );
}

/** Every item of one learner that should have a search record. */
export async function listSearchRecordTargets(
  db: FirebaseFirestore.Firestore,
  userId: string,
): Promise<ISearchRecordTarget[]> {
  const targets: ISearchRecordTarget[] = [];
  for (const itemType of SEARCH_RECORD_ITEM_TYPES) {
    const snapshot = await userDoc(db, userId)
      .collection(sourceCollectionName(itemType))
      .select()
      .get();
    for (const doc of snapshot.docs) {
      targets.push({ userId, itemType, sourceId: doc.id });
    }
  }
  return targets;
}
