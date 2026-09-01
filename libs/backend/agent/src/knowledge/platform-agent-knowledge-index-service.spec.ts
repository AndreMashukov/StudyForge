import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    platformAgentKnowledgeChunks: vi.fn(),
    platformAgentKnowledgeDocuments: vi.fn(),
  },
}));

vi.mock('./agent-embedding-service', () => ({
  AgentEmbeddingService: {
    embedTexts: vi.fn(),
    embedText: vi.fn(),
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
          }),
        },
        {
          data: () => ({
            docId: 'doc-draft',
            docTitle: 'Draft policy',
            text: 'Should not appear.',
            embedding: [1, 0],
          }),
        },
      ],
    });
    const publishedGet = vi.fn().mockResolvedValue({
      docs: [{ id: 'doc-published' }],
    });

    vi.mocked(FirestorePaths.platformAgentKnowledgeChunks).mockReturnValue({
      get: chunkGet,
    } as never);
    vi.mocked(FirestorePaths.platformAgentKnowledgeDocuments).mockReturnValue({
      where: vi.fn().mockReturnValue({ get: publishedGet }),
    } as never);
    vi.mocked(AgentEmbeddingService.embedText).mockResolvedValue([1, 0]);

    const results = await PlatformAgentKnowledgeIndexService.searchPlatformKnowledge({
      userId: 'user-1',
      query: 'document generation',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.docTitle).toBe('Published policy');
  });
});
