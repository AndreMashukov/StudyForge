import MiniSearch, { type SearchResult } from 'minisearch';
import { buildSearchSnippet } from './searchSnippet';
import {
  isUnspacedTerm,
  normalizeSearchText,
  tokenizeSearchText,
  unspacedRuns,
} from './searchTokenizer';
import {
  EMPTY_LIBRARY_SEARCH_RESULTS,
  type ILibrarySearchHit,
  type ILibrarySearchResults,
  type ILocalSearchRecord,
} from './searchTypes';

/** Results shown per section. */
export const LIBRARY_SEARCH_GROUP_LIMIT = 20;

/**
 * Above this much document text the device indexes names, descriptions and
 * tags only: building and holding a larger index is too slow for a phone.
 */
export const LIBRARY_SEARCH_MAX_INDEXED_TEXT_CHARS = 25_000_000;

const BUILD_CHUNK_SIZE = 20;

interface IIndexedDocument {
  id: string;
  title: string;
  description: string;
  tags: string;
  text: string;
}

export interface ILibrarySearchOptions {
  /** Narrow to this directory and everything beneath it. */
  directoryId?: string;
}

export interface ILibrarySearchEngine {
  /** Replaces everything and rebuilds the index without blocking for long. */
  setRecords(records: ILocalSearchRecord[]): Promise<void>;
  applyChanges(
    upserts: ILocalSearchRecord[],
    removedIds: string[],
  ): Promise<void>;
  search(query: string, options?: ILibrarySearchOptions): ILibrarySearchResults;
  getDirectoryTitle(directoryId: string): string | undefined;
  /** False when the library is too large to search document text on this device. */
  isBodyTextIndexed(): boolean;
}

function createIndex(): MiniSearch<IIndexedDocument> {
  return new MiniSearch<IIndexedDocument>({
    fields: ['title', 'description', 'tags', 'text'],
    tokenize: (text) => tokenizeSearchText(text),
    // Terms are already normalized by the tokenizer.
    processTerm: (term) => term,
    searchOptions: {
      combineWith: 'AND',
      boost: { title: 6, tags: 3, description: 2 },
      // Pair terms match exactly; a single unspaced character matches pairs starting with it.
      prefix: (term) => !isUnspacedTerm(term) || [...term].length === 1,
      fuzzy: (term) => (!isUnspacedTerm(term) && term.length >= 4 ? 0.2 : false),
    },
  });
}

function matchedFields(result: SearchResult): Set<string> {
  const fields = new Set<string>();
  for (const names of Object.values(result.match)) {
    for (const name of names) fields.add(name);
  }
  return fields;
}

/**
 * 0: name starts with the query. 1: every query word starts a word of the name.
 * 2: some word matched the name (typo or partial). 3: matched elsewhere.
 */
function rankTier(
  record: ILocalSearchRecord,
  normalizedQuery: string,
  queryTerms: string[],
  fields: Set<string>,
): number {
  const title = normalizeSearchText(record.title);
  if (title.startsWith(normalizedQuery)) {
    return 0;
  }
  const titleTerms = tokenizeSearchText(record.title);
  const everyTermInTitle = queryTerms.every((term) =>
    titleTerms.some((titleTerm) => titleTerm.startsWith(term)),
  );
  if (everyTermInTitle) {
    return 1;
  }
  return fields.has('title') ? 2 : 3;
}

function groupOf(
  record: ILocalSearchRecord,
): keyof ILibrarySearchResults {
  if (record.itemType === 'directory') return 'directories';
  return record.itemType === 'document' ? 'documents' : 'artifacts';
}

export function createLibrarySearchEngine(): ILibrarySearchEngine {
  let records = new Map<string, ILocalSearchRecord>();
  let index = createIndex();
  let bodyTextIndexed = true;

  const totalTextChars = (): number => {
    let total = 0;
    for (const record of records.values()) total += record.text?.length ?? 0;
    return total;
  };

  const toIndexed = (record: ILocalSearchRecord): IIndexedDocument => ({
    id: record.id,
    title: record.title,
    description: record.description ?? '',
    tags: record.tags?.join(' ') ?? '',
    text: bodyTextIndexed ? (record.text ?? '') : '',
  });

  const rebuild = async (): Promise<void> => {
    bodyTextIndexed = totalTextChars() <= LIBRARY_SEARCH_MAX_INDEXED_TEXT_CHARS;
    const next = createIndex();
    await next.addAllAsync([...records.values()].map(toIndexed), {
      chunkSize: BUILD_CHUNK_SIZE,
    });
    index = next;
  };

  const directoryPath = (directoryId: string | null): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = directoryId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const directory = records.get(`directory_${current}`);
      if (!directory) break;
      names.unshift(directory.title);
      current = directory.directoryId;
    }
    return names.join(' › ');
  };

  /** The directory and all its descendants. */
  const directoryTreeIds = (rootId: string): Set<string> => {
    const children = new Map<string, string[]>();
    for (const record of records.values()) {
      if (record.itemType !== 'directory' || !record.directoryId) continue;
      const siblings = children.get(record.directoryId) ?? [];
      siblings.push(record.sourceId);
      children.set(record.directoryId, siblings);
    }
    const ids = new Set<string>([rootId]);
    const queue = [rootId];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const child of children.get(next) ?? []) {
        if (!ids.has(child)) {
          ids.add(child);
          queue.push(child);
        }
      }
    }
    return ids;
  };

  const containsRuns = (record: ILocalSearchRecord, runs: string[]): boolean => {
    const haystack = normalizeSearchText(
      [
        record.title,
        record.description ?? '',
        record.tags?.join(' ') ?? '',
        bodyTextIndexed ? (record.text ?? '') : '',
      ].join('\n'),
    );
    return runs.every((run) => haystack.includes(run));
  };

  return {
    async setRecords(nextRecords) {
      records = new Map(nextRecords.map((record) => [record.id, record]));
      await rebuild();
    },

    async applyChanges(upserts, removedIds) {
      for (const id of removedIds) records.delete(id);
      for (const record of upserts) records.set(record.id, record);

      const fitsNow =
        totalTextChars() <= LIBRARY_SEARCH_MAX_INDEXED_TEXT_CHARS;
      if (fitsNow !== bodyTextIndexed) {
        await rebuild();
        return;
      }
      for (const id of [...removedIds, ...upserts.map((record) => record.id)]) {
        if (index.has(id)) index.discard(id);
      }
      index.addAll(upserts.map(toIndexed));
    },

    search(query, options = {}) {
      const queryTerms = tokenizeSearchText(query);
      if (queryTerms.length === 0) {
        return EMPTY_LIBRARY_SEARCH_RESULTS;
      }
      const normalizedQuery = normalizeSearchText(query.trim());
      const runs = unspacedRuns(query);
      const scope = options.directoryId
        ? directoryTreeIds(options.directoryId)
        : null;

      const inScope = (record: ILocalSearchRecord): boolean => {
        if (!scope) return true;
        if (record.itemType === 'directory') {
          return (
            record.sourceId !== options.directoryId &&
            scope.has(record.sourceId)
          );
        }
        return record.directoryId !== null && scope.has(record.directoryId);
      };

      const ranked = index
        .search(query)
        .flatMap((result) => {
          const record = records.get(String(result.id));
          if (!record || !inScope(record)) return [];
          if (runs.length > 0 && !containsRuns(record, runs)) return [];
          const fields = matchedFields(result);
          return [
            {
              record,
              result,
              fields,
              tier: rankTier(record, normalizedQuery, queryTerms, fields),
            },
          ];
        })
        .sort(
          (left, right) =>
            left.tier - right.tier ||
            right.result.score - left.result.score ||
            left.record.title.localeCompare(right.record.title),
        );

      const results: ILibrarySearchResults = {
        directories: [],
        documents: [],
        artifacts: [],
      };
      for (const { record, result } of ranked) {
        const group = results[groupOf(record)];
        if (group.length >= LIBRARY_SEARCH_GROUP_LIMIT) continue;

        const hit: ILibrarySearchHit = {
          itemType: record.itemType,
          id: record.sourceId,
          title: record.title,
          path: directoryPath(record.directoryId),
        };
        if (record.directoryId) hit.directoryId = record.directoryId;
        if (record.generationStatus) {
          hit.generationStatus = record.generationStatus;
        }
        // Show a passage only for what the name does not already explain:
        // words that matched the text but not the name.
        const textOnlyTerms = Object.entries(result.match)
          .filter(
            ([, names]) => names.includes('text') && !names.includes('title'),
          )
          .map(([term]) => term);
        if (record.text && textOnlyTerms.length > 0) {
          const snippet = buildSearchSnippet(
            record.text,
            new Set(result.terms),
            new Set(textOnlyTerms),
          );
          if (snippet) hit.snippet = snippet;
        }
        group.push(hit);
      }
      return results;
    },

    getDirectoryTitle(directoryId) {
      return records.get(`directory_${directoryId}`)?.title;
    },

    isBodyTextIndexed() {
      return bodyTextIndexed;
    },
  };
}
