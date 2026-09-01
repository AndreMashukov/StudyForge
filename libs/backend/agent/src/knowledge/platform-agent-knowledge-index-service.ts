import { Timestamp } from 'firebase-admin/firestore';
import type { IPlatformAgentKnowledgeChunk } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from './agent-embedding-service';
import { chunkText, cosineSimilarity, hashContent } from './knowledge-chunk-utils';

const MAX_MATCH_COUNT = 6;
const MIN_SIMILARITY = 0.2;
const MAX_BATCH_OPERATIONS = 400;

type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

export interface IReplaceDocumentChunksInput {
  embeddingUserId: string;
  docId: string;
  docTitle: string;
  bodyMarkdown: string;
  sourceContentHash: string;
}

export interface ISearchPlatformKnowledgeInput {
  userId: string;
  query: string;
  matchCount?: number;
}

export interface IPlatformKnowledgeMatch {
  text: string;
  docTitle: string;
  score: number;
}

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
  private static async assertCurrentPublishedRevision(
    input: IReplaceDocumentChunksInput,
  ): Promise<void> {
    const snapshot = await FirestorePaths.platformAgentKnowledgeDocument(
      input.docId,
    ).get();
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.status !== 'published' ||
      data?.indexingStatus !== 'indexing' ||
      data?.publishedContentHash !== input.sourceContentHash
    ) {
      throw new Error('Platform knowledge document changed while indexing');
    }
  }

  static async replaceDocumentChunks(
    input: IReplaceDocumentChunksInput,
  ): Promise<void> {
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

    const embeddingRouteKey = await AgentEmbeddingService.resolveEmbeddingRouteKey(
      input.embeddingUserId,
    );
    const embeddings = await AgentEmbeddingService.embedTexts(
      input.embeddingUserId,
      chunks,
    );
    const routeKeyAfterEmbedding = await AgentEmbeddingService.resolveEmbeddingRouteKey(
      input.embeddingUserId,
    );
    if (routeKeyAfterEmbedding !== embeddingRouteKey) {
      throw new Error('Agent knowledge embedding route changed while indexing');
    }
    const now = new Date().toISOString();

    await PlatformAgentKnowledgeIndexService.assertCurrentPublishedRevision(
      input,
    );

    chunks.forEach((chunk, chunkIndex) => {
      const docRef = collection.doc();
      operations.push((batch) =>
        batch.set(docRef, {
          id: docRef.id,
          docId: input.docId,
          docTitle: input.docTitle,
          text: chunk,
          contentHash: hashContent(chunk),
          sourceContentHash: input.sourceContentHash,
          embeddingUserId: input.embeddingUserId,
          embeddingRouteKey,
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

  static async searchPlatformKnowledge(
    input: ISearchPlatformKnowledgeInput,
  ): Promise<IPlatformKnowledgeMatch[]> {
    const snapshot = await FirestorePaths.platformAgentKnowledgeChunks().get();
    const publishedSnapshot = await FirestorePaths.platformAgentKnowledgeDocuments()
      .where('status', '==', 'published')
      .get();
    const publishedHashes = new Map<string, string>();
    publishedSnapshot.docs.forEach((doc) => {
      const hash = doc.data().publishedContentHash;
      if (typeof hash === 'string') {
        publishedHashes.set(doc.id, hash);
      }
    });

    const queryEmbeddingByRoute = new Map<string, number[]>();
    const scored: IPlatformKnowledgeMatch[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = typeof data.docId === 'string' ? data.docId : '';
      const sourceContentHash =
        typeof data.sourceContentHash === 'string'
          ? data.sourceContentHash
          : '';
      if (publishedHashes.get(docId) !== sourceContentHash) {
        continue;
      }

      const embeddingUserId =
        typeof data.embeddingUserId === 'string'
          ? data.embeddingUserId
          : input.userId;
      const embeddingRouteKey =
        typeof data.embeddingRouteKey === 'string'
          ? data.embeddingRouteKey
          : '';
      if (!embeddingRouteKey) {
        continue;
      }

      const currentRouteKey =
        await AgentEmbeddingService.resolveEmbeddingRouteKey(embeddingUserId);
      if (currentRouteKey !== embeddingRouteKey) {
        continue;
      }

      const cacheKey = `${embeddingUserId}:${embeddingRouteKey}`;
      let queryEmbedding = queryEmbeddingByRoute.get(cacheKey);
      if (!queryEmbedding) {
        queryEmbedding = await AgentEmbeddingService.embedText(
          embeddingUserId,
          input.query,
        );
        queryEmbeddingByRoute.set(cacheKey, queryEmbedding);
      }

      const embedding = Array.isArray(data.embedding)
        ? data.embedding.filter(
            (value): value is number => typeof value === 'number',
          )
        : [];
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score < MIN_SIMILARITY) {
        continue;
      }
      scored.push({
        text: typeof data.text === 'string' ? data.text : '',
        docTitle: typeof data.docTitle === 'string' ? data.docTitle : 'Untitled',
        score,
      });
    }

    scored.sort((left, right) => right.score - left.score);

    return scored.slice(0, input.matchCount ?? MAX_MATCH_COUNT);
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
      sourceContentHash:
        typeof data.sourceContentHash === 'string'
          ? data.sourceContentHash
          : undefined,
      embeddingUserId:
        typeof data.embeddingUserId === 'string'
          ? data.embeddingUserId
          : undefined,
      embeddingRouteKey:
        typeof data.embeddingRouteKey === 'string'
          ? data.embeddingRouteKey
          : undefined,
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
