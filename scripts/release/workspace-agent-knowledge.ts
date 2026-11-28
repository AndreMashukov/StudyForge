import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { WORKSPACE_AGENT_KNOWLEDGE_PATH } from './config';
import type { IReleaseFacts } from './schema';

const INDEX_WAIT_MS = 5 * 60_000;
const STALLED_INDEXING_MS = 10 * 60_000;
const INDEX_POLL_MS = 2_000;

function hashMarkdown(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function workspaceAgentKnowledgeFacts(
  changedFiles: ReadonlySet<string>,
  readSource: () => string | null,
): IReleaseFacts['workspaceAgentKnowledge'] {
  if (!changedFiles.has(WORKSPACE_AGENT_KNOWLEDGE_PATH)) return { status: 'unchanged' };
  const bodyMarkdown = readSource()?.trim();
  return bodyMarkdown ? { status: 'publish', contentHash: hashMarkdown(bodyMarkdown) } : { status: 'invalid' };
}

async function requestIndexing(
  doc: DocumentReference,
  bodyMarkdown: string,
  contentHash: string,
): Promise<'indexed' | 'indexing' | 'reset'> {
  return doc.firestore.runTransaction(async (transaction) => {
    const current = (await transaction.get(doc)).data();
    if (!current) {
      throw new Error('The Firestore document configured by RELEASE_WORKSPACE_KNOWLEDGE_DOCUMENT_ID does not exist.');
    }
    const isSameRevision = current.status === 'published' && current.publishedContentHash === contentHash;
    if (isSameRevision && current.indexingStatus === 'indexed') return 'indexed';

    const alreadyIndexing = current.indexingStatus === 'indexing';
    if (alreadyIndexing) {
      const publishedAt = typeof current.publishedAt === 'string' ? Date.parse(current.publishedAt) : NaN;
      if (Date.now() - publishedAt < STALLED_INDEXING_MS) {
        if (isSameRevision) return 'indexing';
        throw new Error('Another workspace agent knowledge revision is still indexing. Retry the release when it finishes.');
      }
    }

    const configuredUser = process.env.RELEASE_WORKSPACE_KNOWLEDGE_USER_ID?.trim();
    const previousPublisher = typeof current.publishedBy === 'string' ? current.publishedBy.trim() : '';
    const publishedBy = configuredUser || previousPublisher;
    if (!publishedBy || publishedBy.includes('/')) {
      throw new Error('Set RELEASE_WORKSPACE_KNOWLEDGE_USER_ID to a user with an agentKnowledgeEmbedding route.');
    }
    const user = await transaction.get(doc.firestore.collection('users').doc(publishedBy));
    const groupId = user.get('userGroupId');
    if (typeof groupId !== 'string' || !groupId.trim()) {
      throw new Error('The workspace agent knowledge publisher needs a user group with an agentKnowledgeEmbedding route. Set RELEASE_WORKSPACE_KNOWLEDGE_USER_ID to a configured user.');
    }

    if (alreadyIndexing) {
      // The Firestore trigger only starts when the document transitions to indexing.
      transaction.update(doc, { indexingStatus: 'idle' });
      return 'reset';
    }

    const now = new Date().toISOString();
    transaction.update(doc, {
      bodyMarkdown,
      status: 'published',
      publishedContentHash: contentHash,
      publishedBy,
      publishedAt: now,
      updatedAt: now,
      updatedBy: publishedBy,
      indexingStatus: 'indexing',
      indexingError: FieldValue.delete(),
      indexedAt: FieldValue.delete(),
    });
    return 'indexing';
  });
}

async function waitForIndex(doc: DocumentReference, contentHash: string): Promise<void> {
  const deadline = Date.now() + INDEX_WAIT_MS;
  while (Date.now() < deadline) {
    const current = (await doc.get()).data();
    if (current?.status !== 'published' || current.publishedContentHash !== contentHash) {
      throw new Error('The published workspace agent knowledge revision changed while indexing.');
    }
    if (current.indexingStatus === 'indexed') return;
    if (current.indexingStatus === 'failed') {
      throw new Error(`Workspace agent knowledge indexing failed: ${String(current.indexingError ?? 'unknown error')}`);
    }
    await setTimeout(INDEX_POLL_MS);
  }
  throw new Error(`Workspace agent knowledge indexing timed out after ${INDEX_WAIT_MS / 60_000} minutes.`);
}

export async function publishWorkspaceAgentKnowledge(projectId: string, contentHash: string): Promise<void> {
  const bodyMarkdown = readFileSync(WORKSPACE_AGENT_KNOWLEDGE_PATH, 'utf8').trim();
  if (!bodyMarkdown || hashMarkdown(bodyMarkdown) !== contentHash) {
    throw new Error(`The contents of ${WORKSPACE_AGENT_KNOWLEDGE_PATH} do not match the release plan.`);
  }

  const documentId = process.env.RELEASE_WORKSPACE_KNOWLEDGE_DOCUMENT_ID?.trim();
  if (!documentId || documentId.includes('/') || documentId === '.' || documentId === '..') {
    throw new Error('Set RELEASE_WORKSPACE_KNOWLEDGE_DOCUMENT_ID to the existing Firestore knowledge document ID.');
  }

  const app = initializeApp({ projectId });
  try {
    const doc = getFirestore(app).collection('platformAgentKnowledgeDocuments').doc(documentId);
    let state = await requestIndexing(doc, bodyMarkdown, contentHash);
    if (state === 'reset') state = await requestIndexing(doc, bodyMarkdown, contentHash);
    if (state === 'reset') throw new Error('A stalled workspace agent knowledge publication changed during the retry.');
    if (state === 'indexing') await waitForIndex(doc, contentHash);
    console.log(`Workspace agent knowledge is indexed in ${projectId} (${contentHash}).`);
  } finally {
    await deleteApp(app);
  }
}
