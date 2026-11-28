import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_AGENT_KNOWLEDGE_PATH } from './config';
import {
  publishWorkspaceAgentKnowledge,
  workspaceAgentKnowledgeFacts,
} from './workspace-agent-knowledge';

const firestore = vi.hoisted(() => {
  const transaction = { get: vi.fn(), update: vi.fn() };
  const runTransaction = vi.fn(
    (apply: (tx: typeof transaction) => Promise<string>) => apply(transaction),
  );
  const readIndexStatus = vi.fn();
  const doc = vi.fn();
  const collection = vi.fn(() => ({ doc }));
  const document = {
    firestore: { collection, runTransaction },
    get: readIndexStatus,
  };
  doc.mockReturnValue(document);
  return { collection, doc, document, readIndexStatus, transaction };
});

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  deleteApp: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: firestore.collection }),
  FieldValue: { delete: vi.fn() },
}));

const project = 'demo-release-knowledge';
const originalId = 'original-knowledge-doc';
const markdown = readFileSync(WORKSPACE_AGENT_KNOWLEDGE_PATH, 'utf8').trim();
const facts = workspaceAgentKnowledgeFacts(
  new Set([WORKSPACE_AGENT_KNOWLEDGE_PATH]),
  () => markdown,
);
if (facts.status !== 'publish')
  throw new Error(
    'The workspace agent knowledge test needs the Markdown source',
  );
const { contentHash } = facts;

describe('publishWorkspaceAgentKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RELEASE_WORKSPACE_KNOWLEDGE_DOCUMENT_ID', originalId);
    vi.stubEnv('RELEASE_WORKSPACE_KNOWLEDGE_USER_ID', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('updates the configured Firestore record in place', async () => {
    firestore.transaction.get
      .mockResolvedValueOnce({
        data: () => ({ status: 'published', publishedBy: 'publisher-uid' }),
      })
      .mockResolvedValueOnce({ get: () => 'publisher-group' });
    firestore.readIndexStatus.mockResolvedValueOnce({
      data: () => ({
        status: 'published',
        publishedContentHash: contentHash,
        indexingStatus: 'indexed',
      }),
    });

    await publishWorkspaceAgentKnowledge(project, contentHash);

    expect(firestore.collection).toHaveBeenNthCalledWith(
      1,
      'platformAgentKnowledgeDocuments',
    );
    expect(firestore.doc).toHaveBeenNthCalledWith(1, originalId);
    expect(firestore.transaction.update).toHaveBeenCalledExactlyOnceWith(
      firestore.document,
      expect.objectContaining({
        bodyMarkdown: markdown,
        publishedContentHash: contentHash,
        indexingStatus: 'indexing',
      }),
    );
  });

  it('fails without writing if the configured Firestore record is missing', async () => {
    firestore.transaction.get.mockResolvedValueOnce({ data: () => undefined });

    await expect(
      publishWorkspaceAgentKnowledge(project, contentHash),
    ).rejects.toThrow('does not exist');

    expect(firestore.doc).toHaveBeenCalledExactlyOnceWith(originalId);
    expect(firestore.transaction.update).not.toHaveBeenCalled();
  });
});
