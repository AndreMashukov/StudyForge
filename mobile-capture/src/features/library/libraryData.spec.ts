import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDocumentContent, parseDirectoryItems, subscribeDirectoryItems, type ILibraryDocument } from './libraryData';

const mocks = vi.hoisted(() => ({ getDownloadURL: vi.fn(), ref: vi.fn((_storage: unknown, path: string) => path), onSnapshot: vi.fn(), collection: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ db: {}, storage: {} }));
vi.mock('../../lib/api/directoryTreeFirestore', () => ({ buildDirectoryTreeFromDirectories: vi.fn(), toDirectory: vi.fn() }));
vi.mock('firebase/storage', () => ({ getDownloadURL: mocks.getDownloadURL, ref: mocks.ref }));
vi.mock('firebase/firestore', () => ({ collection: mocks.collection, onSnapshot: mocks.onSnapshot }));

const document: ILibraryDocument = { id: 'doc', title: 'Example', directoryId: 'dir' };

describe('library data', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('validates index rows and excludes malformed rows', () => {
    const docs = [
      { id: 'good', data: () => ({ sourceId: 'doc', directoryId: 'dir', title: 'Document', itemType: 'document', createdAt: new Date() }) },
      { id: 'bad', data: () => ({ sourceId: 'bad', itemType: 'document' }) },
    ];
    expect(parseDirectoryItems(docs).map((item) => item.id)).toEqual(['good']);
  });

  it('falls back from missing HTML to legacy Markdown', async () => {
    mocks.getDownloadURL.mockRejectedValueOnce({ code: 'storage/object-not-found' }).mockResolvedValueOnce('https://example.com/doc');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '# Legacy' }));
    await expect(fetchDocumentContent('user', document)).resolves.toEqual({ content: '# Legacy', format: 'markdown' });
    expect(mocks.ref.mock.calls.map((call) => call[1])).toEqual(['users/user/documents/doc/content.html', 'users/user/documents/doc/content.md']);
  });

  it('surfaces permission errors without trying a different file', async () => {
    const error = { code: 'storage/unauthorized' };
    mocks.getDownloadURL.mockRejectedValue(error);
    await expect(fetchDocumentContent('user', document)).rejects.toEqual(error);
    expect(mocks.getDownloadURL).toHaveBeenCalledTimes(1);
  });

  it('rejects another account’s storage path', async () => {
    await expect(fetchDocumentContent('user', { ...document, storagePath: 'users/other/documents/doc/content.html' })).rejects.toThrow('Invalid document storage path');
    expect(mocks.getDownloadURL).not.toHaveBeenCalled();
  });

  it('forwards live changes and errors, then ignores events after unsubscribe', () => {
    const unsubscribe = vi.fn();
    let emit: (snapshot: { metadata: { fromCache: boolean }; docs: Array<{ id: string; data: () => unknown }> }) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    mocks.onSnapshot.mockImplementation((_ref, _options, next, error) => { emit = next; fail = error; return unsubscribe; });
    const onItems = vi.fn();
    const onError = vi.fn();
    const stop = subscribeDirectoryItems('user-a', 'dir', onItems, onError);
    expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'users', 'user-a', 'directories', 'dir', 'items');
    emit({ metadata: { fromCache: true }, docs: [] });
    expect(onItems).not.toHaveBeenCalled();
    emit({ metadata: { fromCache: false }, docs: [{ id: 'a', data: () => ({ sourceId: 'doc', directoryId: 'dir', title: 'New', itemType: 'document', createdAt: new Date(), generationStatus: 'pending' }) }] });
    expect(onItems).toHaveBeenLastCalledWith([expect.objectContaining({ title: 'New', generationStatus: 'pending' })]);
    emit({ metadata: { fromCache: false }, docs: [{ id: 'a', data: () => ({ sourceId: 'doc', directoryId: 'dir', title: 'New', itemType: 'document', createdAt: new Date(), generationStatus: 'completed' }) }] });
    expect(onItems).toHaveBeenLastCalledWith([expect.objectContaining({ generationStatus: 'completed' })]);
    emit({ metadata: { fromCache: false }, docs: [] });
    expect(onItems).toHaveBeenLastCalledWith([]);
    fail(new Error('permission denied'));
    expect(onError).toHaveBeenCalledOnce();
    stop();
    emit({ metadata: { fromCache: false }, docs: [] });
    fail(new Error('late error'));
    expect(onItems).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
