import { describe, expect, it } from 'vitest';
import {
  SEARCH_TEXT_MAX_CHARS,
  buildSearchRecord,
  buildSearchRecordTombstone,
  capSearchText,
  htmlToSearchText,
  isDocumentTextExpected,
  isSearchSourceDeleted,
  markdownToSearchText,
  searchableFieldsChanged,
} from './search-record-builders';

describe('htmlToSearchText', () => {
  it('strips tags, scripts and comments and decodes entities', () => {
    const html =
      '<h2>Krebs &amp; cycle</h2><style>p{color:red}</style><!-- note -->' +
      '<p>Caf&eacute; &#233; &#x4e2d;&nbsp;done</p><script>alert(1)</script>';
    expect(htmlToSearchText(html)).toBe('Krebs & cycle Caf&eacute; é 中 done');
  });
});

describe('markdownToSearchText', () => {
  it('drops markdown syntax and keeps link text', () => {
    expect(
      markdownToSearchText('# Title\n\n- **bold** [link](http://x.test) `code`'),
    ).toBe('Title bold link code');
  });
});

describe('capSearchText', () => {
  it('leaves short text alone', () => {
    expect(capSearchText('hello')).toEqual({ text: 'hello', truncated: false });
  });

  it('cuts at the character cap', () => {
    const result = capSearchText('a'.repeat(SEARCH_TEXT_MAX_CHARS + 10));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(SEARCH_TEXT_MAX_CHARS);
  });

  it('never splits a surrogate pair', () => {
    const result = capSearchText('a' + '😀'.repeat(SEARCH_TEXT_MAX_CHARS));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(SEARCH_TEXT_MAX_CHARS - 1);
    expect(result.text.endsWith('😀')).toBe(true);
  });
});

describe('buildSearchRecord', () => {
  it('builds a directory record from name and parent', () => {
    const record = buildSearchRecord(
      {
        itemType: 'directory',
        sourceId: 'dir-1',
        raw: { name: 'Biology', parentId: null, documentCount: 4 },
      },
      1,
    );
    expect(record).toMatchObject({
      itemType: 'directory',
      sourceId: 'dir-1',
      directoryId: null,
      title: 'Biology',
      deleted: false,
    });
  });

  it('includes text, description and tags for documents and omits unset fields', () => {
    const record = buildSearchRecord(
      {
        itemType: 'document',
        sourceId: 'doc-1',
        raw: { title: 'Cells', directoryId: 'dir-1', description: '', tags: ['bio'] },
        text: { text: 'mitochondria', truncated: false, sourceMd5: 'abc' },
      },
      1,
    );
    expect(record.text).toBe('mitochondria');
    expect(record.tags).toEqual(['bio']);
    expect(record.sourceMd5).toBe('abc');
    expect(Object.values(record)).not.toContain(undefined);
    expect('description' in record).toBe(false);
    expect('textTruncated' in record).toBe(false);
  });

  it('changes the hash only when a searchable field changes', () => {
    const build = (raw: Record<string, unknown>) =>
      buildSearchRecord({ itemType: 'quiz', sourceId: 'q-1', raw }, 1);
    const base = build({ title: 'Quiz', directoryId: 'dir-1', questions: [1] });
    expect(
      build({ title: 'Quiz', directoryId: 'dir-1', questions: [1, 2] })
        .contentHash,
    ).toBe(base.contentHash);
    expect(
      build({ title: 'Quiz 2', directoryId: 'dir-1' }).contentHash,
    ).not.toBe(base.contentHash);
  });

  it('builds a tombstone with no searchable content', () => {
    expect(buildSearchRecordTombstone('document', 'doc-1', 1)).toMatchObject({
      deleted: true,
      title: '',
      directoryId: null,
    });
  });
});

describe('source state', () => {
  it('treats soft-deleted documents as gone', () => {
    expect(isSearchSourceDeleted('document', { status: 'deleted' })).toBe(true);
    expect(isSearchSourceDeleted('document', { status: 'archived' })).toBe(false);
    expect(isSearchSourceDeleted('quiz', { status: 'deleted' })).toBe(false);
  });

  it('expects text only for ready documents', () => {
    expect(isDocumentTextExpected({})).toBe(true);
    expect(isDocumentTextExpected({ generationStatus: 'completed' })).toBe(true);
    expect(isDocumentTextExpected({ generationStatus: 'pending' })).toBe(false);
    expect(isDocumentTextExpected({ generationStatus: 'failed' })).toBe(false);
  });
});

describe('searchableFieldsChanged', () => {
  it('ignores directory counter updates', () => {
    expect(
      searchableFieldsChanged(
        'directory',
        { name: 'Bio', parentId: null, documentCount: 1 },
        { name: 'Bio', parentId: null, documentCount: 2 },
      ),
    ).toBe(false);
  });

  it('detects renames, moves and document saves', () => {
    expect(
      searchableFieldsChanged('directory', { name: 'Bio' }, { name: 'Biology' }),
    ).toBe(true);
    expect(
      searchableFieldsChanged(
        'flashcard',
        { title: 'Set', directoryId: 'a' },
        { title: 'Set', directoryId: 'b' },
      ),
    ).toBe(true);
    expect(
      searchableFieldsChanged(
        'document',
        { title: 'Doc', wordCount: 10 },
        { title: 'Doc', wordCount: 12 },
      ),
    ).toBe(true);
  });

  it('compares timestamps with isEqual', () => {
    const stamp = (seconds: number) => ({
      seconds,
      isEqual: (other: unknown) =>
        typeof other === 'object' &&
        other !== null &&
        'seconds' in other &&
        other.seconds === seconds,
    });
    expect(
      searchableFieldsChanged(
        'document',
        { updatedAt: stamp(1) },
        { updatedAt: stamp(1) },
      ),
    ).toBe(false);
    expect(
      searchableFieldsChanged(
        'document',
        { updatedAt: stamp(1) },
        { updatedAt: stamp(2) },
      ),
    ).toBe(true);
  });
});
