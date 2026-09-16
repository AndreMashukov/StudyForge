import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as admin from 'firebase-admin';

const PROJECT_ID =
  process.env.NX_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  'study-forge-202604';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const TARGET_UID =
  process.env.SEED_AUTH_UID || '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';
const DOC_ID = 'workspace-agent-knowledge-base';
const TITLE = 'Workspace agent knowledge base';
const TAGS = ['workspace-agent', 'generation-policy', 'credits'];
const DOCUMENTS_COLLECTION = 'platformAgentKnowledgeDocuments';
const CHUNKS_COLLECTION = 'platformAgentKnowledgeChunks';
const KNOWLEDGE_PATH = resolve(
  process.cwd(),
  'docs/workspace-agent-knowledge-base.md',
);
const INDEX_WAIT_MS = 90_000;
const INDEX_POLL_MS = 2_000;

function hashMarkdownContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function seedWorkspaceAgentKnowledge(options?: {
  userId?: string;
}): Promise<{ documentId: string; chunkCount: number }> {
  const publishedBy = options?.userId ?? TARGET_UID;
  if (!existsSync(KNOWLEDGE_PATH)) {
    throw new Error(`Knowledge file not found: ${KNOWLEDGE_PATH}`);
  }

  const bodyMarkdown = readFileSync(KNOWLEDGE_PATH, 'utf8').trim();
  if (!bodyMarkdown) {
    throw new Error('Knowledge file is empty');
  }

  const publishedContentHash = hashMarkdownContent(bodyMarkdown);
  const now = nowIso();
  const db = admin.firestore();
  const docRef = db.collection(DOCUMENTS_COLLECTION).doc(DOC_ID);
  const payload = {
    id: DOC_ID,
    title: TITLE,
    bodyMarkdown,
    tags: TAGS,
    status: 'published' as const,
    publishedContentHash,
    publishedBy,
    publishedAt: now,
    updatedAt: now,
    updatedBy: publishedBy,
  };

  await docRef.set({
    ...payload,
    indexingStatus: 'idle',
  });
  await docRef.set(
    {
      ...payload,
      indexingStatus: 'indexing',
      indexingError: admin.firestore.FieldValue.delete(),
    },
    { merge: true },
  );

  const deadline = Date.now() + INDEX_WAIT_MS;
  while (Date.now() < deadline) {
    const snap = await docRef.get();
    const data = snap.data();
    if (data?.indexingStatus === 'indexed') {
      const chunks = await db
        .collection(CHUNKS_COLLECTION)
        .where('docId', '==', DOC_ID)
        .get();
      return { documentId: DOC_ID, chunkCount: chunks.size };
    }
    if (data?.indexingStatus === 'failed') {
      throw new Error(
        `Knowledge indexing failed: ${String(data.indexingError ?? 'unknown')}`,
      );
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, INDEX_POLL_MS));
  }

  throw new Error(
    `Knowledge indexing timed out after ${INDEX_WAIT_MS}ms (document ${DOC_ID})`,
  );
}

async function main(): Promise<void> {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  console.log(`Firestore emulator: ${FIRESTORE_HOST}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Document id: ${DOC_ID}`);
  console.log(`Embedding user: ${TARGET_UID}`);

  const result = await seedWorkspaceAgentKnowledge({ userId: TARGET_UID });
  console.log(
    `Indexed ${result.documentId} (${result.chunkCount} chunks)`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
