import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import type {
  AgentActionResult,
  AgentMessageInput,
  AgentMessageResponse,
  AgentMessageStreamEvent,
  AgentPromptContext,
  AgentProposedDelete,
  AgentScope,
  AgentThreadSummary,
  GetAgentThreadResponse,
  IAgentThread,
  IAgentThreadMessage,
} from '@shared-types';
import { agentPromptContextSchema } from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentEmbeddingService } from '../knowledge/agent-embedding-service';
import { cosineSimilarity } from '../knowledge/knowledge-chunk-utils';

const MEMORY_MATCH_COUNT = 6;
const MEMORY_MIN_SIMILARITY = 0.25;
const THREAD_TITLE_MAX_CHARS = 80;
const THREAD_PREVIEW_MAX_CHARS = 140;
const THREAD_LIST_DEFAULT_LIMIT = 50;
const THREAD_MESSAGES_MAX_RETURNED = 200;
const FALLBACK_THREAD_TITLE = 'Conversation';

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function truncateText(value: string, maxLength: number): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function deriveAgentThreadTitle(content: string): string {
  const title = truncateText(content, THREAD_TITLE_MAX_CHARS);
  return title.length > 0 ? title : FALLBACK_THREAD_TITLE;
}

export function deriveAgentThreadPreview(content: string): string | undefined {
  const preview = truncateText(content, THREAD_PREVIEW_MAX_CHARS);
  return preview.length > 0 ? preview : undefined;
}

function timestampToIso(value: unknown, fallback: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function mapThread(
  id: string,
  data: DocumentData | undefined,
  userId: string,
  fallbackIso: string,
): IAgentThread {
  return {
    id,
    userId: optionalString(data?.userId) ?? userId,
    scope: data?.scope === 'directory' ? 'directory' : 'workspace',
    directoryId: optionalString(data?.directoryId),
    title: optionalString(data?.title),
    preview: optionalString(data?.preview),
    createdAt: timestampToIso(data?.createdAt, fallbackIso),
    updatedAt: timestampToIso(data?.updatedAt, fallbackIso),
    lastMessageAt: timestampToIso(data?.lastMessageAt, fallbackIso),
  };
}

function toThreadSummary(thread: IAgentThread): AgentThreadSummary {
  return {
    id: thread.id,
    title: thread.title ?? FALLBACK_THREAD_TITLE,
    preview: thread.preview,
    scope: thread.scope,
    directoryId: thread.directoryId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessageAt: thread.lastMessageAt,
  };
}

function parseStoredPromptContext(
  value: unknown,
): AgentPromptContext | undefined {
  const parsed = agentPromptContextSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export interface AgentMemorySnippet {
  content: string;
  memoryType: string;
  score: number;
}

function extractMemoryCandidates(
  message: string,
  assistantReply: string,
): string[] {
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
    query: string,
  ): Promise<AgentMemorySnippet[]> {
    const queryEmbedding = await AgentEmbeddingService.embedText(userId, query);
    const snapshot =
      await FirestorePaths.agentConversationMemories(userId).get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const embedding = Array.isArray(data.embedding)
          ? data.embedding.filter(
              (value): value is number => typeof value === 'number',
            )
          : [];
        const content = typeof data.content === 'string' ? data.content : '';
        const memoryType =
          typeof data.memoryType === 'string' ? data.memoryType : 'fact';

        return {
          content,
          memoryType,
          score: cosineSimilarity(queryEmbedding, embedding),
        };
      })
      .filter(
        (entry) =>
          entry.content.length > 0 && entry.score >= MEMORY_MIN_SIMILARITY,
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, MEMORY_MATCH_COUNT);
  }

  static async captureTurnMemories(input: {
    userId: string;
    threadId: string;
    userMessage: string;
    assistantReply: string;
  }): Promise<void> {
    const candidates = extractMemoryCandidates(
      input.userMessage,
      input.assistantReply,
    );
    if (candidates.length === 0) {
      return;
    }

    const embeddings = await AgentEmbeddingService.embedTexts(
      input.userId,
      candidates,
    );
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
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimestamp = Timestamp.fromDate(now);

    if (input.threadId) {
      const existing = await FirestorePaths.agentThread(
        input.userId,
        input.threadId,
      ).get();
      if (existing.exists) {
        const data = existing.data();
        if (data && data.userId === input.userId) {
          await existing.ref.update({
            updatedAt: nowTimestamp,
            lastMessageAt: nowTimestamp,
          });
          return {
            ...mapThread(existing.id, data, input.userId, nowIso),
            updatedAt: nowIso,
            lastMessageAt: nowIso,
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
      createdAt: nowIso,
      updatedAt: nowIso,
      lastMessageAt: nowIso,
    };

    await docRef.set({
      id: thread.id,
      userId: thread.userId,
      scope: thread.scope,
      ...(thread.directoryId ? { directoryId: thread.directoryId } : {}),
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
      lastMessageAt: nowTimestamp,
    });

    return thread;
  }

  static async getThread(
    userId: string,
    threadId: string,
  ): Promise<GetAgentThreadResponse | null> {
    const snapshot = await FirestorePaths.agentThread(userId, threadId).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    if (!data || data.userId !== userId) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const messages = await this.listRecentMessages(
      userId,
      threadId,
      THREAD_MESSAGES_MAX_RETURNED,
    );

    return {
      thread: mapThread(snapshot.id, data, userId, nowIso),
      messages,
    };
  }

  static async listThreads(
    userId: string,
    limit = THREAD_LIST_DEFAULT_LIMIT,
  ): Promise<AgentThreadSummary[]> {
    const snapshot = await FirestorePaths.agentThreads(userId)
      .orderBy('lastMessageAt', 'desc')
      .limit(limit)
      .get();

    const nowIso = new Date().toISOString();
    return snapshot.docs
      .map((doc) => mapThread(doc.id, doc.data(), userId, nowIso))
      .filter((thread) => thread.userId === userId)
      .map(toThreadSummary);
  }

  static async appendMessage(input: {
    userId: string;
    threadId: string;
    role: 'user' | 'assistant';
    content: string;
    promptContext?: AgentPromptContext;
    executedActions?: AgentActionResult[];
    proposedDeletes?: AgentProposedDelete[];
    title?: string;
    preview?: string;
  }): Promise<IAgentThreadMessage> {
    const now = new Date();
    const docRef = FirestorePaths.agentThreadMessages(
      input.userId,
      input.threadId,
    ).doc();
    const message: IAgentThreadMessage = {
      id: docRef.id,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      createdAt: now.toISOString(),
      promptContext: input.promptContext,
      executedActions: input.executedActions,
      proposedDeletes: input.proposedDeletes,
    };

    await docRef.set({
      role: input.role,
      content: input.content,
      createdAt: Timestamp.fromDate(now),
      ...(input.promptContext ? { promptContext: input.promptContext } : {}),
      executedActions: input.executedActions ?? [],
      proposedDeletes: input.proposedDeletes ?? [],
    });

    await FirestorePaths.agentThread(input.userId, input.threadId).update({
      updatedAt: Timestamp.fromDate(now),
      lastMessageAt: Timestamp.fromDate(now),
      ...(input.title ? { title: input.title } : {}),
      ...(input.preview ? { preview: input.preview } : {}),
    });

    return message;
  }

  static async listRecentMessages(
    userId: string,
    threadId: string,
    limit = 20,
  ): Promise<IAgentThreadMessage[]> {
    const snapshot = await FirestorePaths.agentThreadMessages(userId, threadId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const fallbackIso = new Date().toISOString();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const promptContext = parseStoredPromptContext(data.promptContext);
        return {
          id: doc.id,
          threadId,
          role: data.role === 'assistant' ? 'assistant' : 'user',
          content: typeof data.content === 'string' ? data.content : '',
          createdAt: timestampToIso(data.createdAt, fallbackIso),
          ...(promptContext ? { promptContext } : {}),
          executedActions: Array.isArray(data.executedActions)
            ? data.executedActions
            : undefined,
          proposedDeletes: Array.isArray(data.proposedDeletes)
            ? data.proposedDeletes
            : undefined,
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
