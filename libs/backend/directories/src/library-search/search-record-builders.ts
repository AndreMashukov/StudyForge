import { createHash } from 'node:crypto';
import type {
  LibrarySearchItemType,
  LibrarySearchRecord,
} from '@shared-types';

/**
 * Pure builders for library search records.
 *
 * Runtime imports stay npm/node only: the backfill migration runs this file
 * with plain `tsx`, which does not resolve the workspace path aliases.
 */

/**
 * Document text kept on a search record, in UTF-16 units. At most 3 bytes per
 * unit in UTF-8, so a record stays far below Firestore's 1 MiB document limit.
 */
export const SEARCH_TEXT_MAX_CHARS = 100_000;

export type SearchSourceData = Record<string, unknown>;

export interface ISearchRecordText {
  text: string;
  truncated: boolean;
  sourceMd5?: string;
}

export interface ISearchRecordSource {
  itemType: LibrarySearchItemType;
  sourceId: string;
  raw: SearchSourceData;
  /** Extracted body text; documents only. */
  text?: ISearchRecordText;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  deg: '°',
  times: '×',
};

function decodeCodePoint(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return fallback;
  }
  return String.fromCodePoint(codePoint);
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi,
    (match, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        return decodeCodePoint(Number.parseInt(body.slice(2), 16), match);
      }
      if (body.startsWith('#')) {
        return decodeCodePoint(Number.parseInt(body.slice(1), 10), match);
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function htmlToSearchText(html: string): string {
  const withoutMarkup = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return collapseWhitespace(decodeHtmlEntities(withoutMarkup));
}

export function markdownToSearchText(markdown: string): string {
  const withoutMarkup = markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[`*_~]+/g, ' ');
  return collapseWhitespace(withoutMarkup);
}

/** Cuts at the cap without splitting a surrogate pair. */
export function capSearchText(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= SEARCH_TEXT_MAX_CHARS) {
    return { text, truncated: false };
  }
  const lastKept = text.charCodeAt(SEARCH_TEXT_MAX_CHARS - 1);
  const splitsPair = lastKept >= 0xd800 && lastKept <= 0xdbff;
  const end = splitsPair ? SEARCH_TEXT_MAX_CHARS - 1 : SEARCH_TEXT_MAX_CHARS;
  return { text: text.slice(0, end).trimEnd(), truncated: true };
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function readTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const tags = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  );
  return tags.length > 0 ? tags : undefined;
}

function readGenerationStatus(
  value: unknown,
): LibrarySearchRecord['generationStatus'] {
  return value === 'pending' || value === 'completed' || value === 'failed'
    ? value
    : undefined;
}

/** Soft-deleted documents are treated like a missing source. */
export function isSearchSourceDeleted(
  itemType: LibrarySearchItemType,
  raw: SearchSourceData,
): boolean {
  return itemType === 'document' && raw.status === 'deleted';
}

/** Body text is indexed only once a document is ready; older records have no status. */
export function isDocumentTextExpected(raw: SearchSourceData): boolean {
  const status = readGenerationStatus(raw.generationStatus);
  return status === undefined || status === 'completed';
}

const SEARCHABLE_FIELDS: Record<'directory' | 'document' | 'artifact', string[]> =
  {
    directory: ['name', 'parentId'],
    document: [
      'title',
      'description',
      'tags',
      'directoryId',
      'status',
      'generationStatus',
      'contentFormat',
      'storagePath',
      'storageUrl',
      'wordCount',
      'updatedAt',
    ],
    artifact: ['title', 'directoryId', 'generationStatus'],
  };

function searchableFieldsFor(itemType: LibrarySearchItemType): string[] {
  if (itemType === 'directory' || itemType === 'document') {
    return SEARCHABLE_FIELDS[itemType];
  }
  return SEARCHABLE_FIELDS.artifact;
}

function hasIsEqual(
  value: unknown,
): value is { isEqual: (other: unknown) => boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isEqual' in value &&
    typeof value.isEqual === 'function'
  );
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (hasIsEqual(left)) {
    return left.isEqual(right);
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * True when a write touched something a search record is built from. Lets the
 * trigger ignore counter and ordering updates without any reads.
 */
export function searchableFieldsChanged(
  itemType: LibrarySearchItemType,
  before: SearchSourceData,
  after: SearchSourceData,
): boolean {
  return searchableFieldsFor(itemType).some(
    (field) => !valuesEqual(before[field], after[field]),
  );
}

type SearchRecordFields = Omit<LibrarySearchRecord, 'contentHash'>;

function computeContentHash(fields: SearchRecordFields): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        fields.schemaVersion,
        fields.itemType,
        fields.sourceId,
        fields.directoryId,
        fields.title,
        fields.description ?? null,
        fields.tags ?? null,
        fields.text ?? null,
        fields.textTruncated ?? false,
        fields.generationStatus ?? null,
        fields.deleted,
      ]),
    )
    .digest('hex');
}

/** Adds the hash and leaves out unset optionals, which Firestore rejects as `undefined`. */
function finalize(fields: SearchRecordFields): LibrarySearchRecord {
  const record: LibrarySearchRecord = {
    itemType: fields.itemType,
    sourceId: fields.sourceId,
    directoryId: fields.directoryId,
    title: fields.title,
    contentHash: computeContentHash(fields),
    deleted: fields.deleted,
    schemaVersion: fields.schemaVersion,
  };
  if (fields.description !== undefined) record.description = fields.description;
  if (fields.tags !== undefined) record.tags = fields.tags;
  if (fields.text !== undefined) record.text = fields.text;
  if (fields.textTruncated !== undefined) {
    record.textTruncated = fields.textTruncated;
  }
  if (fields.generationStatus !== undefined) {
    record.generationStatus = fields.generationStatus;
  }
  if (fields.sourceMd5 !== undefined) record.sourceMd5 = fields.sourceMd5;
  return record;
}

export function buildSearchRecord(
  source: ISearchRecordSource,
  schemaVersion: number,
): LibrarySearchRecord {
  const { itemType, sourceId, raw, text } = source;

  if (itemType === 'directory') {
    return finalize({
      itemType,
      sourceId,
      directoryId: readNonEmptyString(raw.parentId) ?? null,
      title: readNonEmptyString(raw.name) ?? 'Untitled',
      deleted: false,
      schemaVersion,
    });
  }

  const base = {
    itemType,
    sourceId,
    directoryId: readNonEmptyString(raw.directoryId) ?? null,
    generationStatus: readGenerationStatus(raw.generationStatus),
    deleted: false,
    schemaVersion,
  };

  if (itemType !== 'document') {
    return finalize({
      ...base,
      title: readNonEmptyString(raw.title) ?? 'Untitled',
    });
  }

  return finalize({
    ...base,
    title: readNonEmptyString(raw.title) ?? 'Untitled Document',
    description: readNonEmptyString(raw.description),
    tags: readTags(raw.tags),
    text: text && text.text.length > 0 ? text.text : undefined,
    textTruncated: text?.truncated ? true : undefined,
    sourceMd5: text?.sourceMd5,
  });
}

/** Record left behind when the source item is gone, so devices drop it. */
export function buildSearchRecordTombstone(
  itemType: LibrarySearchItemType,
  sourceId: string,
  schemaVersion: number,
): LibrarySearchRecord {
  return finalize({
    itemType,
    sourceId,
    directoryId: null,
    title: '',
    deleted: true,
    schemaVersion,
  });
}
