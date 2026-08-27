import {
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import type {
  AgentThreadSummary,
  GetAgentThreadResponse,
  IAgentThread,
  IAgentThreadMessage,
} from '@shared-types';
import { agentThreadMessagesCollection, agentThreadRef, userCollection } from './firestorePaths';
import { toFirestoreDoc } from './firestoreReadUtils';

const THREAD_LIST_DEFAULT_LIMIT = 50;
const THREAD_MESSAGES_MAX_RETURNED = 200;
const FALLBACK_THREAD_TITLE = 'Conversation';

function timestampToIso(value: unknown, fallback: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function mapThread(
  id: string,
  data: Record<string, unknown> | undefined,
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
    lastMessageAt: timestampToIso(
      data?.lastMessageAt,
      timestampToIso(data?.updatedAt, timestampToIso(data?.createdAt, fallbackIso)),
    ),
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

function mapMessage(id: string, data: Record<string, unknown>): IAgentThreadMessage {
  return toFirestoreDoc<IAgentThreadMessage>(id, data);
}

export async function getAgentThreadFromFirestore(
  userId: string,
  threadId: string,
): Promise<GetAgentThreadResponse | null> {
  const threadSnap = await getDoc(agentThreadRef(userId, threadId));
  if (!threadSnap.exists()) {
    return null;
  }

  const fallbackIso = new Date().toISOString();
  const thread = mapThread(threadSnap.id, threadSnap.data(), userId, fallbackIso);

  const messagesSnap = await getDocs(
    query(
      agentThreadMessagesCollection(userId, threadId),
      orderBy('createdAt', 'asc'),
      limit(THREAD_MESSAGES_MAX_RETURNED),
    ),
  );

  const messages = messagesSnap.docs.map((messageDoc) =>
    mapMessage(messageDoc.id, messageDoc.data()),
  );

  return { thread, messages };
}

export async function listAgentThreadsFromFirestore(
  userId: string,
  listLimit = THREAD_LIST_DEFAULT_LIMIT,
): Promise<AgentThreadSummary[]> {
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'agentThreads'),
      orderBy('lastMessageAt', 'desc'),
      limit(listLimit),
    ),
  );

  const fallbackIso = new Date().toISOString();
  return snapshot.docs.map((threadDoc) =>
    toThreadSummary(mapThread(threadDoc.id, threadDoc.data(), userId, fallbackIso)),
  );
}
