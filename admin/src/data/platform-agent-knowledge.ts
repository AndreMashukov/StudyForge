import 'server-only';

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  ICreatePlatformAgentKnowledgeDocumentRequest,
  IPlatformAgentKnowledgeDocument,
  IUpdatePlatformAgentKnowledgeDocumentRequest,
  PlatformAgentKnowledgeDocumentStatus,
  PlatformAgentKnowledgeIndexingStatus,
} from '@shared-types';
import { platformAgentKnowledgeDocumentFormSchema } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminApp, getAdminFirestore } from '../firebase/admin';

const COLLECTION = 'platformAgentKnowledgeDocuments';

interface IPlatformAgentKnowledgeDocumentUpdates {
  title?: string;
  bodyMarkdown?: string;
  tags?: string[] | FirebaseFirestore.FieldValue;
  status?: PlatformAgentKnowledgeDocumentStatus;
  updatedAt?: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  publishedContentHash?: string | FirebaseFirestore.FieldValue;
  indexedAt?: string | FirebaseFirestore.FieldValue;
  indexingStatus?: PlatformAgentKnowledgeIndexingStatus;
  indexingError?: string | FirebaseFirestore.FieldValue | null;
}

function hashMarkdownContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function parseDocument(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IPlatformAgentKnowledgeDocument | null {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const bodyMarkdown =
    typeof data.bodyMarkdown === 'string' ? data.bodyMarkdown : '';
  const status = data.status;
  const indexingStatus = data.indexingStatus;

  if (
    !title ||
    !bodyMarkdown ||
    (status !== 'draft' && status !== 'published') ||
    (indexingStatus !== 'idle' &&
      indexingStatus !== 'indexing' &&
      indexingStatus !== 'indexed' &&
      indexingStatus !== 'failed')
  ) {
    return null;
  }

  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  return {
    id,
    title,
    bodyMarkdown,
    status,
    tags: tags?.length ? tags : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    publishedAt:
      typeof data.publishedAt === 'string' ? data.publishedAt : undefined,
    publishedBy:
      typeof data.publishedBy === 'string' ? data.publishedBy : undefined,
    publishedContentHash:
      typeof data.publishedContentHash === 'string'
        ? data.publishedContentHash
        : undefined,
    indexedAt: typeof data.indexedAt === 'string' ? data.indexedAt : undefined,
    indexingStatus,
    indexingError:
      typeof data.indexingError === 'string' ? data.indexingError : undefined,
  };
}

function validateCreatePayload(
  payload: ICreatePlatformAgentKnowledgeDocumentRequest,
): ICreatePlatformAgentKnowledgeDocumentRequest {
  const parsed = platformAgentKnowledgeDocumentFormSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid knowledge document payload.';
    throw new Error(message);
  }
  return parsed.data;
}

export async function listPlatformAgentKnowledgeDocuments(): Promise<
  IPlatformAgentKnowledgeDocument[]
> {
  await requireAdminSession();
  getAdminApp();

  const snapshot = await getAdminFirestore()
    .collection(COLLECTION)
    .orderBy('updatedAt', 'desc')
    .get();

  const documents: IPlatformAgentKnowledgeDocument[] = [];
  for (const doc of snapshot.docs) {
    const parsed = parseDocument(doc.id, doc.data());
    if (parsed) {
      documents.push(parsed);
    }
  }
  return documents;
}

export async function getPlatformAgentKnowledgeDocument(
  docId: string,
): Promise<IPlatformAgentKnowledgeDocument | null> {
  await requireAdminSession();
  getAdminApp();

  const doc = await getAdminFirestore().collection(COLLECTION).doc(docId).get();
  if (!doc.exists) {
    return null;
  }
  return parseDocument(doc.id, doc.data() ?? {});
}

export async function createPlatformAgentKnowledgeDocument(
  payload: ICreatePlatformAgentKnowledgeDocumentRequest,
  adminUid: string,
): Promise<IPlatformAgentKnowledgeDocument> {
  await requireAdminSession();
  getAdminApp();

  const validated = validateCreatePayload(payload);
  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTION).doc();

  const record: IPlatformAgentKnowledgeDocument = {
    id: ref.id,
    title: validated.title,
    bodyMarkdown: validated.bodyMarkdown,
    status: 'draft',
    updatedAt: now,
    updatedBy: adminUid,
    indexingStatus: 'idle',
  };
  if (validated.tags?.length) {
    record.tags = validated.tags;
  }

  await ref.set(record);
  return record;
}

export async function updatePlatformAgentKnowledgeDocument(
  docId: string,
  payload: IUpdatePlatformAgentKnowledgeDocumentRequest,
  adminUid: string,
): Promise<IPlatformAgentKnowledgeDocument> {
  await requireAdminSession();
  getAdminApp();

  const existing = await getPlatformAgentKnowledgeDocument(docId);
  if (!existing) {
    throw new Error('Knowledge document not found.');
  }

  const merged = {
    title: payload.title?.trim() ?? existing.title,
    bodyMarkdown: payload.bodyMarkdown ?? existing.bodyMarkdown,
    tags: payload.tags ?? existing.tags,
  };
  const validated = validateCreatePayload(merged);
  const now = new Date().toISOString();

  const updates: IPlatformAgentKnowledgeDocumentUpdates = {
    title: validated.title,
    bodyMarkdown: validated.bodyMarkdown,
    tags: validated.tags?.length ? validated.tags : FieldValue.delete(),
    updatedAt: now,
    updatedBy: adminUid,
  };

  if (existing.status === 'published') {
    updates.indexingStatus = 'idle';
    updates.indexingError = FieldValue.delete();
    updates.publishedContentHash = FieldValue.delete();
    updates.indexedAt = FieldValue.delete();
  }

  await getAdminFirestore().collection(COLLECTION).doc(docId).set(updates, {
    merge: true,
  });

  const updated = await getPlatformAgentKnowledgeDocument(docId);
  if (!updated) {
    throw new Error('Failed to load updated knowledge document.');
  }
  return updated;
}

export async function publishPlatformAgentKnowledgeDocument(
  docId: string,
  adminUid: string,
): Promise<IPlatformAgentKnowledgeDocument> {
  await requireAdminSession();
  getAdminApp();

  const existing = await getPlatformAgentKnowledgeDocument(docId);
  if (!existing) {
    throw new Error('Knowledge document not found.');
  }

  const now = new Date().toISOString();
  const publishedContentHash = hashMarkdownContent(existing.bodyMarkdown);
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId)
    .set(
      {
        status: 'published' satisfies PlatformAgentKnowledgeDocumentStatus,
        publishedAt: now,
        publishedBy: adminUid,
        publishedContentHash,
        updatedAt: now,
        updatedBy: adminUid,
        indexingStatus: 'indexing' satisfies PlatformAgentKnowledgeIndexingStatus,
        indexingError: FieldValue.delete(),
      },
      { merge: true },
    );

  const published = await getPlatformAgentKnowledgeDocument(docId);
  if (!published) {
    throw new Error('Failed to load published knowledge document.');
  }
  return published;
}

export async function deletePlatformAgentKnowledgeDocument(
  docId: string,
): Promise<void> {
  await requireAdminSession();
  getAdminApp();

  const chunks = await getAdminFirestore()
    .collection('platformAgentKnowledgeChunks')
    .where('docId', '==', docId)
    .get();
  const batch = getAdminFirestore().batch();
  chunks.docs.forEach((chunk) => batch.delete(chunk.ref));
  await batch.commit();
  await getAdminFirestore().collection(COLLECTION).doc(docId).delete();
}
