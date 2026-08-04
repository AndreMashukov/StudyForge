import { Timestamp } from 'firebase-admin/firestore';
import type { AgentKnowledgeSourceType, IAgentKnowledgeChunk } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from './agent-embedding-service';
import { chunkText, hashContent, stripHtmlToText } from './knowledge-chunk-utils';
import { cosineSimilarity } from './knowledge-chunk-utils';

export interface KnowledgeChunkIndexInput {
  userId: string;
  sourceType: AgentKnowledgeSourceType;
  sourceId: string;
  sourceTitle: string;
  text: string;
  directoryId?: string;
  documentId?: string;
}

const MAX_MATCH_COUNT = 8;
const MIN_SIMILARITY = 0.2;

export class AgentKnowledgeIndexService {
  static async replaceSourceChunks(input: KnowledgeChunkIndexInput): Promise<void> {
    const chunks = chunkText(input.text);
    const collection = FirestorePaths.agentKnowledgeChunks(input.userId);
    const existing = await collection
      .where('sourceType', '==', input.sourceType)
      .where('sourceId', '==', input.sourceId)
      .get();

    const batch = collection.firestore.batch();
    existing.docs.forEach((doc) => batch.delete(doc.ref));

    if (chunks.length === 0) {
      await batch.commit();
      return;
    }

    const embeddings = await AgentEmbeddingService.embedTexts(input.userId, chunks);
    const now = new Date().toISOString();

    chunks.forEach((chunk, chunkIndex) => {
      const docRef = collection.doc();
      batch.set(docRef, {
        id: docRef.id,
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceTitle: input.sourceTitle,
        directoryId: input.directoryId ?? null,
        documentId: input.documentId ?? null,
        text: chunk,
        contentHash: hashContent(chunk),
        chunkIndex,
        embedding: embeddings[chunkIndex] ?? [],
        updatedAt: now,
      });
    });

    await batch.commit();
  }

  static async deleteSourceIndex(
    userId: string,
    sourceType: AgentKnowledgeSourceType,
    sourceId: string
  ): Promise<void> {
    const collection = FirestorePaths.agentKnowledgeChunks(userId);
    const existing = await collection
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .get();

    if (existing.empty) {
      return;
    }

    const batch = collection.firestore.batch();
    existing.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  static async searchKnowledge(input: {
    userId: string;
    query: string;
    directoryIds?: string[];
    matchCount?: number;
  }): Promise<Array<{ text: string; sourceTitle: string; score: number }>> {
    const queryEmbedding = await AgentEmbeddingService.embedText(input.userId, input.query);
    const snapshot = await FirestorePaths.agentKnowledgeChunks(input.userId).get();

    const allowedDirectoryIds = input.directoryIds ? new Set(input.directoryIds) : null;

    const scored = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const embedding = Array.isArray(data.embedding)
          ? data.embedding.filter((value): value is number => typeof value === 'number')
          : [];

        if (allowedDirectoryIds && data.directoryId && !allowedDirectoryIds.has(data.directoryId)) {
          return null;
        }

        return {
          text: typeof data.text === 'string' ? data.text : '',
          sourceTitle: typeof data.sourceTitle === 'string' ? data.sourceTitle : 'Untitled',
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      })
      .filter((entry): entry is { text: string; sourceTitle: string; score: number } => entry !== null)
      .filter((entry) => entry.score >= MIN_SIMILARITY)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.matchCount ?? MAX_MATCH_COUNT);

    return scored;
  }

  static formatDocumentText(title: string, description: string | undefined, content: string): string {
    const body = content.includes('<') ? stripHtmlToText(content) : content.trim();
    return `Document: ${title}\nDescription: ${description?.trim() || 'No description'}\n\n${body}`;
  }

  static toChunkRecord(doc: FirebaseFirestore.QueryDocumentSnapshot): IAgentKnowledgeChunk {
    const data = doc.data();
    return {
      id: doc.id,
      userId: typeof data.userId === 'string' ? data.userId : '',
      sourceType: data.sourceType as IAgentKnowledgeChunk['sourceType'],
      sourceId: typeof data.sourceId === 'string' ? data.sourceId : '',
      sourceTitle: typeof data.sourceTitle === 'string' ? data.sourceTitle : 'Untitled',
      directoryId: typeof data.directoryId === 'string' ? data.directoryId : undefined,
      documentId: typeof data.documentId === 'string' ? data.documentId : undefined,
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
