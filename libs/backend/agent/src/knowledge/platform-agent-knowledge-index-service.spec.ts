import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    platformAgentKnowledgeChunks: vi.fn(),
    platformAgentKnowledgeDocuments: vi.fn(),
    platformAgentKnowledgeDocument: vi.fn(),
  },
}));

vi.mock('./agent-embedding-service', () => ({
  AgentEmbeddingService: {
    embedTexts: vi.fn(),
    embedText: vi.fn(),
    resolveEmbeddingRouteKey: vi.fn(),
  },
}));

import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from './agent-embedding-service';
import { PlatformAgentKnowledgeIndexService } from './platform-agent-knowledge-index-service';

describe('PlatformAgentKnowledgeIndexService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches only published knowledge chunks', async () => {
    const chunkGet = vi.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            docId: 'doc-published',
            docTitle: 'Published policy',
            text: 'Use create_document for prompt docs.',
            embedding: [1, 0],
            sourceContentHash: 'hash-published',
            embeddingUserId: 'admin-1',
            embeddingRouteKey: 'route-1',
          }),
        },
        {
          data: () => ({
            docId: 'doc-draft',
            docTitle: 'Draft policy',
            text: 'Should not appear.',
            embedding: [1, 0],
            sourceContentHash: 'hash-draft',
            embeddingUserId: 'admin-1',
            embeddingRouteKey: 'route-1',
          }),
        },
      ],
    });
    const publishedGet = vi.fn().mockResolvedValue({
      docs: [
        {
          id: 'doc-published',
          data: () => ({ publishedContentHash: 'hash-published' }),
        },
      ],
    });

    vi.mocked(FirestorePaths.platformAgentKnowledgeChunks).mockReturnValue({
      get: chunkGet,
    } as never);
    vi.mocked(FirestorePaths.platformAgentKnowledgeDocuments).mockReturnValue({
      where: vi.fn().mockReturnValue({ get: publishedGet }),
    } as never);
    vi.mocked(AgentEmbeddingService.resolveEmbeddingRouteKey).mockResolvedValue(
      'route-1',
    );
    vi.mocked(AgentEmbeddingService.embedText).mockResolvedValue([1, 0]);

    const results = await PlatformAgentKnowledgeIndexService.searchPlatformKnowledge({
      userId: 'user-1',
      query: 'document generation',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.docTitle).toBe('Published policy');
  });

  it('does not commit stale chunks when the published revision changes', async () => {
    const commit = vi.fn();
    const set = vi.fn();
    const deleteDoc = vi.fn();
    const collection = {
      firestore: {},
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: [{ ref: 'old-chunk', data: () => ({}) }],
        }),
      }),
      doc: vi.fn().mockReturnValue({ id: 'chunk-1' }),
    };
    collection.firestore = {
      batch: vi.fn().mockReturnValue({
        delete: deleteDoc,
        set,
        commit,
      }),
    };

    vi.mocked(FirestorePaths.platformAgentKnowledgeChunks).mockReturnValue(
      collection as never,
    );
    vi.mocked(FirestorePaths.platformAgentKnowledgeDocument).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          status: 'published',
          indexingStatus: 'indexing',
          publishedContentHash: 'new-hash',
        }),
      }),
    } as never);
    vi.mocked(AgentEmbeddingService.resolveEmbeddingRouteKey).mockResolvedValue(
      'route-1',
    );
    vi.mocked(AgentEmbeddingService.embedTexts).mockResolvedValue([[1, 0]]);

    await expect(
      PlatformAgentKnowledgeIndexService.replaceDocumentChunks({
        embeddingUserId: 'admin-1',
        docId: 'doc-1',
        docTitle: 'Policy',
        bodyMarkdown: 'Policy content',
        sourceContentHash: 'old-hash',
      }),
    ).rejects.toThrow('changed while indexing');

    expect(commit).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
