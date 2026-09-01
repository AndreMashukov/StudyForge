import { Timestamp } from 'firebase-admin/firestore';
import type { IPlatformAgentKnowledgeChunk } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from './agent-embedding-service';
import { chunkText, cosineSimilarity, hashContent } from './knowledge-chunk-utils';

const MAX_MATCH_COUNT = 6;
const MIN_SIMILARITY = 0.2;
const MAX_BATCH_OPERATIONS = 400;

type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

async function commitInBatches(
  firestore: FirebaseFirestore.Firestore,
  operations: BatchOperation[],
): Promise<void> {
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = firestore.batch();
    operations.slice(index, index + MAX_BATCH_OPERATIONS).forEach((apply) => apply(batch));
    await batch.commit();
  }
}

export class PlatformAgentKnowledgeIndexService {
  static async replaceDocumentChunks(input: {
    embeddingUserId: string;
    docId: string;
    docTitle: string;
    bodyMarkdown: string;
  }): Promise<void> {
    const chunks = chunkText(input.bodyMarkdown);
    const collection = FirestorePaths.platformAgentKnowledgeChunks();
    const existing = await collection.where('docId', '==', input.docId).get();

    const operations: BatchOperation[] = [];
    existing.docs.forEach((doc) =>
      operations.push((batch) => batch.delete(doc.ref)),
    );

    if (chunks.length === 0) {
      await commitInBatches(collection.firestore, operations);
      return;
    }

    const embeddings = await AgentEmbeddingService.embedTexts(
      input.embeddingUserId,
      chunks,
    );
    const now = new Date().toISOString();

    chunks.forEach((chunk, chunkIndex) => {
      const docRef = collection.doc();
      operations.push((batch) =>
        batch.set(docRef, {
          id: docRef.id,
          docId: input.docId,
          docTitle: input.docTitle,
          text: chunk,
          contentHash: hashContent(chunk),
          chunkIndex,
          embedding: embeddings[chunkIndex] ?? [],
          updatedAt: now,
        }),
      );
    });

    await commitInBatches(collection.firestore, operations);
  }

  static async deleteDocumentChunks(docId: string): Promise<void> {
    const collection = FirestorePaths.platformAgentKnowledgeChunks();
    const existing = await collection.where('docId', '==', docId).get();
    if (existing.empty) {
      return;
    }

    const operations: BatchOperation[] = [];
    existing.docs.forEach((doc) =>
      operations.push((batch) => batch.delete(doc.ref)),
    );
    await commitInBatches(collection.firestore, operations);
  }

  static async searchPlatformKnowledge(input: {
    userId: string;
    query: string;
    matchCount?: number;
  }): Promise<Array<{ text: string; docTitle: string; score: number }>> {
    const queryEmbedding = await AgentEmbeddingService.embedText(
      input.userId,
      input.query,
    );
    const snapshot = await FirestorePaths.platformAgentKnowledgeChunks().get();
    const publishedSnapshot = await FirestorePaths.platformAgentKnowledgeDocuments()
      .where('status', '==', 'published')
      .get();
    const publishedDocIds = new Set(publishedSnapshot.docs.map((doc) => doc.id));

    const scored = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const docId = typeof data.docId === 'string' ? data.docId : '';
        if (!publishedDocIds.has(docId)) {
          return null;
        }
        const embedding = Array.isArray(data.embedding)
          ? data.embedding.filter(
              (value): value is number => typeof value === 'number',
            )
          : [];

        return {
          text: typeof data.text === 'string' ? data.text : '',
          docTitle:
            typeof data.docTitle === 'string' ? data.docTitle : 'Untitled',
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      })
      .filter(
        (
          entry,
        ): entry is { text: string; docTitle: string; score: number } =>
          entry !== null,
      )
      .filter((entry) => entry.score >= MIN_SIMILARITY)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.matchCount ?? MAX_MATCH_COUNT);

    return scored;
  }

  static toChunkRecord(
    doc: FirebaseFirestore.QueryDocumentSnapshot,
  ): IPlatformAgentKnowledgeChunk {
    const data = doc.data();
    return {
      id: doc.id,
      docId: typeof data.docId === 'string' ? data.docId : '',
      docTitle: typeof data.docTitle === 'string' ? data.docTitle : 'Untitled',
      text: typeof data.text === 'string' ? data.text : '',
      contentHash: typeof data.contentHash === 'string' ? data.contentHash : '',
      chunkIndex: typeof data.chunkIndex === 'number' ? data.chunkIndex : 0,
      embedding: Array.isArray(data.embedding)
        ? data.embedding.filter((value): value is number => typeof value === 'number')
        : undefined,
      updatedAt:
        data.updatedAt instanceof Timestamp
          ? data.updatedAt.toDate().toISOString()
          : typeof data.updatedAt === 'string'
            ? data.updatedAt
            : new Date().toISOString(),
    };
  }
}
