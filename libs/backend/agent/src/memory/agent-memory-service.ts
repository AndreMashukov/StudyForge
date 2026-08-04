import { Timestamp } from 'firebase-admin/firestore';
import type {
  AgentActionResult,
  AgentMessageInput,
  AgentMessageResponse,
  AgentMessageStreamEvent,
  AgentProposedDelete,
  AgentScope,
  IAgentThread,
  IAgentThreadMessage,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from '../knowledge/agent-embedding-service';
import { cosineSimilarity } from '../knowledge/knowledge-chunk-utils';

const MEMORY_MATCH_COUNT = 6;
const MEMORY_MIN_SIMILARITY = 0.25;

export interface AgentMemorySnippet {
  content: string;
  memoryType: string;
  score: number;
}

function extractMemoryCandidates(message: string, assistantReply: string): string[] {
  const combined = `${message}\n${assistantReply}`;
  const patterns = [
    /remember(?:\s+that|\s+to|\s+my)?\s+(.{8,240})/gi,
    /my preference is\s+(.{8,240})/gi,
    /i prefer\s+(.{8,240})/gi,
    /always\s+(.{8,240})/gi,
    /never\s+(.{8,240})/gi,
    /call me\s+(.{2,80})/gi,
  ];

  const results = new Set<string>();
  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) {
        results.add(value.slice(0, 400));
      }
    }
  }

  return [...results];
}

export class AgentMemoryService {
  static async retrieveRelevantMemories(
    userId: string,
    query: string
  ): Promise<AgentMemorySnippet[]> {
    const queryEmbedding = await AgentEmbeddingService.embedText(userId, query);
    const snapshot = await FirestorePaths.agentConversationMemories(userId).get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const embedding = Array.isArray(data.embedding)
          ? data.embedding.filter((value): value is number => typeof value === 'number')
          : [];
        const content = typeof data.content === 'string' ? data.content : '';
        const memoryType = typeof data.memoryType === 'string' ? data.memoryType : 'fact';

        return {
          content,
          memoryType,
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      })
      .filter((entry) => entry.content.length > 0 && entry.score >= MEMORY_MIN_SIMILARITY)
      .sort((left, right) => right.score - left.score)
      .slice(0, MEMORY_MATCH_COUNT);
  }

  static async captureTurnMemories(input: {
    userId: string;
    threadId: string;
    userMessage: string;
    assistantReply: string;
  }): Promise<void> {
    const candidates = extractMemoryCandidates(input.userMessage, input.assistantReply);
    if (candidates.length === 0) {
      return;
    }

    const embeddings = await AgentEmbeddingService.embedTexts(input.userId, candidates);
    const collection = FirestorePaths.agentConversationMemories(input.userId);
    const batch = collection.firestore.batch();
    const now = new Date().toISOString();

    candidates.forEach((content, index) => {
      const docRef = collection.doc();
      batch.set(docRef, {
        id: docRef.id,
        userId: input.userId,
        threadId: input.threadId,
        content,
        memoryType: 'fact',
        embedding: embeddings[index] ?? [],
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
  }
}

export class AgentThreadStore {
  static async resolveThread(input: {
    userId: string;
    threadId?: string;
    scope: AgentScope;
    directoryId?: string;
  }): Promise<IAgentThread> {
    const now = new Date().toISOString();

    if (input.threadId) {
      const existing = await FirestorePaths.agentThread(input.userId, input.threadId).get();
      if (existing.exists) {
        const data = existing.data();
        if (data && data.userId === input.userId) {
          await existing.ref.update({ updatedAt: now, lastMessageAt: now });
          return {
            id: existing.id,
            userId: input.userId,
            scope: data.scope === 'directory' ? 'directory' : 'workspace',
            directoryId: typeof data.directoryId === 'string' ? data.directoryId : undefined,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString()
                : now,
            updatedAt: now,
            lastMessageAt: now,
          };
        }
      }
    }

    const docRef = FirestorePaths.agentThreads(input.userId).doc();
    const thread: IAgentThread = {
      id: docRef.id,
      userId: input.userId,
      scope: input.scope,
      directoryId: input.directoryId,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };

    await docRef.set({
      id: thread.id,
      userId: thread.userId,
      scope: thread.scope,
      ...(thread.directoryId ? { directoryId: thread.directoryId } : {}),
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.fromDate(new Date(now)),
      lastMessageAt: Timestamp.fromDate(new Date(now)),
    });

    return thread;
  }

  static async appendMessage(input: {
    userId: string;
    threadId: string;
    role: 'user' | 'assistant';
    content: string;
    executedActions?: AgentActionResult[];
    proposedDeletes?: AgentProposedDelete[];
  }): Promise<IAgentThreadMessage> {
    const now = new Date();
    const docRef = FirestorePaths.agentThreadMessages(input.userId, input.threadId).doc();
    const message: IAgentThreadMessage = {
      id: docRef.id,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      createdAt: now.toISOString(),
      executedActions: input.executedActions,
      proposedDeletes: input.proposedDeletes,
    };

    await docRef.set({
      role: input.role,
      content: input.content,
      createdAt: Timestamp.fromDate(now),
      executedActions: input.executedActions ?? [],
      proposedDeletes: input.proposedDeletes ?? [],
    });

    await FirestorePaths.agentThread(input.userId, input.threadId).update({
      updatedAt: Timestamp.fromDate(now),
      lastMessageAt: Timestamp.fromDate(now),
    });

    return message;
  }

  static async listRecentMessages(
    userId: string,
    threadId: string,
    limit = 20
  ): Promise<IAgentThreadMessage[]> {
    const snapshot = await FirestorePaths.agentThreadMessages(userId, threadId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          threadId,
          role: data.role === 'assistant' ? 'assistant' : 'user',
          content: typeof data.content === 'string' ? data.content : '',
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
          executedActions: Array.isArray(data.executedActions) ? data.executedActions : undefined,
          proposedDeletes: Array.isArray(data.proposedDeletes) ? data.proposedDeletes : undefined,
        } satisfies IAgentThreadMessage;
      })
      .reverse();
  }
}

export interface AgentStreamContext {
  onEvent: (event: AgentMessageStreamEvent) => void;
}

export function buildAgentResponse(input: {
  reply: string;
  threadId: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
}): AgentMessageResponse {
  return {
    reply: input.reply,
    threadId: input.threadId,
    executedActions: input.executedActions,
    proposedDeletes: input.proposedDeletes,
  };
}

export type PreparedAgentRun = AgentMessageInput & {
  userId: string;
};
