import { describe, expect, it } from 'vitest';
import { createLibrarySearchClient } from './librarySearchClient';
import { createLibrarySearchEngine } from './searchEngine';
import { buildSearchSnippet } from './searchSnippet';
import type { ISearchRecordChanges } from './searchSync';
import {
  iterateSearchTokens,
  normalizeSearchText,
  tokenizeSearchText,
  unspacedRuns,
} from './searchTokenizer';
import {
  createMemoryLibrarySearchStore,
  type ILocalSearchRecord,
} from './searchTypes';

function record(
  itemType: ILocalSearchRecord['itemType'],
  sourceId: string,
  title: string,
  extra: Partial<ILocalSearchRecord> = {},
): ILocalSearchRecord {
  return {
    id: `${itemType}_${sourceId}`,
    itemType,
    sourceId,
    directoryId: null,
    title,
    ...extra,
  };
}

const LIBRARY: ILocalSearchRecord[] = [
  record('directory', 'bio', 'Biology'),
  record('directory', 'cells', 'Cell Biology', { directoryId: 'bio' }),
  record('directory', 'chem', 'Chemistry'),
  record('document', 'resp', 'Cell respiration', {
    directoryId: 'cells',
    text: 'Glycolysis comes first. Then the Krebs cycle turns acetyl-CoA into energy inside the mitochondria.',
  }),
  record('document', 'krebs', 'Krebs cycle notes', {
    directoryId: 'chem',
    text: 'Short notes.',
  }),
  record('quiz', 'q1', 'Krebs cycle quiz', { directoryId: 'cells' }),
  record('document', 'zh', '细胞生物学', {
    directoryId: 'bio',
    text: '线粒体是细胞呼吸的主要场所。',
  }),
  record('document', 'ru', 'Клеточное дыхание', {
    directoryId: 'bio',
    text: 'Митохондрии вырабатывают энергию.',
  }),
];

async function engineWith(records: ILocalSearchRecord[]) {
  const engine = createLibrarySearchEngine();
  await engine.setRecords(records);
  return engine;
}

describe('search tokenizer', () => {
  it('splits spaced scripts into normalized words', () => {
    expect(tokenizeSearchText('Café-au-lait, Ёлка!')).toEqual([
      'cafe',
      'au',
      'lait',
      'елка',
    ]);
  });

  it('indexes unspaced scripts as overlapping pairs', () => {
    expect(tokenizeSearchText('细胞呼吸')).toEqual(['细胞', '胞呼', '呼吸']);
    expect(tokenizeSearchText('中')).toEqual(['中']);
  });

  it('separates mixed-script runs', () => {
    expect(tokenizeSearchText('ATP合成酶v2')).toEqual([
      'atp',
      '合成',
      '成酶',
      'v2',
    ]);
  });

  it('reports offsets into the original text', () => {
    const text = 'The Krebs cycle';
    const token = [...iterateSearchTokens(text)][1];
    expect(text.slice(token.start, token.end)).toBe('Krebs');
  });

  it('extracts unspaced runs of a query', () => {
    expect(unspacedRuns('krebs 细胞呼吸 中')).toEqual(['细胞呼吸']);
    expect(normalizeSearchText('ÉCOLE')).toBe('ecole');
  });
});

describe('search engine', () => {
  it('returns nothing for an empty query', async () => {
    const engine = await engineWith(LIBRARY);
    expect(engine.search('   ').documents).toEqual([]);
  });

  it('matches names by prefix and groups by kind', async () => {
    const engine = await engineWith(LIBRARY);
    const results = engine.search('bio');
    expect(results.directories.map((hit) => hit.id)).toEqual(['bio', 'cells']);
    expect(results.directories[1].path).toBe('Biology');
  });

  it('ranks name matches above text matches', async () => {
    const engine = await engineWith(LIBRARY);
    const results = engine.search('krebs');
    expect(results.documents.map((hit) => hit.id)).toEqual(['krebs', 'resp']);
    expect(results.artifacts.map((hit) => hit.id)).toEqual(['q1']);
  });

  it('shows a highlighted snippet only when the text is what matched', async () => {
    const engine = await engineWith(LIBRARY);
    const [byName, byText] = engine.search('krebs').documents;
    expect(byName.snippet).toBeUndefined();
    expect(
      byText.snippet?.filter((segment) => segment.highlighted),
    ).toEqual([{ text: 'Krebs', highlighted: true }]);
  });

  it('anchors the snippet on the word the name does not explain', async () => {
    const engine = await engineWith(LIBRARY);
    const [hit] = engine.search('respiration glycolysis').documents;
    expect(hit.id).toBe('resp');
    expect(hit.snippet?.find((segment) => segment.highlighted)?.text).toBe(
      'Glycolysis',
    );
    expect(engine.search('respiraton').documents[0].snippet).toBeUndefined();
  });

  it('tolerates typos in longer words', async () => {
    const engine = await engineWith(LIBRARY);
    expect(engine.search('mitocondria').documents.map((hit) => hit.id)).toEqual(
      ['resp'],
    );
  });

  it('requires every word to match', async () => {
    const engine = await engineWith(LIBRARY);
    expect(engine.search('krebs glycolysis').documents.map((hit) => hit.id)).toEqual(
      ['resp'],
    );
    expect(engine.search('krebs zebra').documents).toEqual([]);
  });

  it('finds unspaced text by substring and rejects scattered pairs', async () => {
    const engine = await engineWith([
      ...LIBRARY,
      record('document', 'scatter', 'Other', { text: '细胞很小。我们呼吸。胞呼' }),
    ]);
    expect(engine.search('细胞呼吸').documents.map((hit) => hit.id)).toEqual([
      'zh',
    ]);
    expect(engine.search('线').documents.map((hit) => hit.id)).toEqual(['zh']);
  });

  it('matches Cyrillic by prefix', async () => {
    const engine = await engineWith(LIBRARY);
    expect(engine.search('митохон').documents.map((hit) => hit.id)).toEqual([
      'ru',
    ]);
  });

  it('narrows to a directory and its descendants', async () => {
    const engine = await engineWith(LIBRARY);
    const results = engine.search('krebs', { directoryId: 'bio' });
    expect(results.documents.map((hit) => hit.id)).toEqual(['resp']);
    expect(results.artifacts.map((hit) => hit.id)).toEqual(['q1']);
    expect(
      engine.search('biology', { directoryId: 'bio' }).directories.map(
        (hit) => hit.id,
      ),
    ).toEqual(['cells']);
  });

  it('applies upserts and removals incrementally', async () => {
    const engine = await engineWith(LIBRARY);
    await engine.applyChanges(
      [record('document', 'krebs', 'Citric acid notes', { directoryId: 'chem' })],
      ['quiz_q1'],
    );
    const results = engine.search('krebs');
    expect(results.documents.map((hit) => hit.id)).toEqual(['resp']);
    expect(results.artifacts).toEqual([]);
    expect(engine.search('citric').documents.map((hit) => hit.id)).toEqual([
      'krebs',
    ]);
  });
});

describe('search snippet', () => {
  it('adds ellipses when the passage is cut', () => {
    const text = `${'word '.repeat(40)}mitochondria ${'tail '.repeat(40)}`;
    const snippet = buildSearchSnippet(text, new Set(['mitochondria']));
    expect(snippet?.[0]).toEqual({ text: '…', highlighted: false });
    expect(snippet?.[snippet.length - 1]).toEqual({
      text: '…',
      highlighted: false,
    });
    expect(snippet?.some((s) => s.highlighted && s.text === 'mitochondria')).toBe(
      true,
    );
  });

  it('merges overlapping pair highlights', () => {
    const snippet = buildSearchSnippet(
      '线粒体是细胞呼吸的主要场所',
      new Set(['细胞', '胞呼', '呼吸']),
    );
    expect(snippet?.filter((s) => s.highlighted)).toEqual([
      { text: '细胞呼吸', highlighted: true },
    ]);
  });

  it('returns null when no term occurs', () => {
    expect(buildSearchSnippet('nothing here', new Set(['krebs']))).toBeNull();
  });
});

describe('library search client', () => {
  const DAY = 24 * 60 * 60 * 1000;

  function setup(pages: ISearchRecordChanges[]) {
    const calls: Array<number | null> = [];
    let time = 1_000_000;
    const store = createMemoryLibrarySearchStore();
    const create = (userId = 'u1') =>
      createLibrarySearchClient({
        userId,
        store,
        now: () => time,
        fetchChanges: async (_userId, since) => {
          calls.push(since);
          const next = pages.shift();
          if (!next) throw new Error('offline');
          return next;
        },
      });
    return {
      calls,
      store,
      create,
      advance: (ms: number) => {
        time += ms;
      },
    };
  }

  it('returns nothing before start and results after the first full sync', async () => {
    const { create, calls } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
    ]);
    const client = create();
    expect(client.search('krebs').documents).toEqual([]);
    await client.sync();
    expect(calls).toEqual([null]);
    expect(client.search('krebs').documents).toHaveLength(2);
    expect(client.getStatus()).toMatchObject({ ready: true, hasSynced: true });
  });

  it('syncs incrementally from the cursor and applies removals', async () => {
    const { create, calls } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
      { upserts: [], removedIds: ['document_krebs'], cursorMillis: 700 },
      { upserts: [], removedIds: [], cursorMillis: null },
    ]);
    const client = create();
    await client.sync();
    await client.sync();
    await client.sync();
    expect(calls).toEqual([null, 500, 700]);
    expect(client.search('krebs').documents.map((hit) => hit.id)).toEqual([
      'resp',
    ]);
  });

  it('restores from the store without a network round trip', async () => {
    const { create } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
    ]);
    await create().sync();
    const restored = create();
    await restored.start();
    expect(restored.search('krebs').documents).toHaveLength(2);
    await expect(restored.sync()).rejects.toThrow('offline');
    expect(restored.search('krebs').documents).toHaveLength(2);
    expect(restored.getStatus().syncing).toBe(false);
  });

  it('syncs from scratch after a long gap or for another learner', async () => {
    const { create, calls, advance } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
      { upserts: [LIBRARY[0]], removedIds: [], cursorMillis: 900 },
      { upserts: [], removedIds: [], cursorMillis: null },
    ]);
    const client = create();
    await client.sync();
    advance(26 * DAY);
    await client.sync();
    expect(calls).toEqual([null, null]);
    expect(client.search('krebs').documents).toEqual([]);

    const other = create('u2');
    await other.start();
    expect(other.search('biology').directories).toEqual([]);
    await other.sync();
    expect(calls).toEqual([null, null, null]);
  });

  it('notifies subscribers and bumps the version when results can change', async () => {
    const { create } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
      { upserts: [], removedIds: [], cursorMillis: null },
    ]);
    const client = create();
    let notified = 0;
    client.subscribe(() => {
      notified += 1;
    });
    await client.sync();
    const version = client.getStatus().version;
    expect(notified).toBeGreaterThan(0);
    await client.sync();
    expect(client.getStatus().version).toBe(version);
  });

  it('shares one run between concurrent syncs and forgets on clear', async () => {
    const { create, calls } = setup([
      { upserts: LIBRARY, removedIds: [], cursorMillis: 500 },
    ]);
    const client = create();
    await Promise.all([client.sync(), client.sync()]);
    expect(calls).toHaveLength(1);
    await client.clear();
    expect(client.search('krebs').documents).toEqual([]);
    expect(client.getStatus().hasSynced).toBe(false);
  });
});
