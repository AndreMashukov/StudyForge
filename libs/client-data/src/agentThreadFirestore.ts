import {
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import type {
  AgentThreadSummary,
  GetAgentThreadResponse,
  IAgentThread,
  IAgentThreadMessage,
} from '@shared-types';
import {
  agentActionResultSchema,
  agentMessageTurnStatusSchema,
  agentPromptContextSchema,
  agentProposedDeleteSchema,
  agentQuestionSchema,
  agentReferencedItemSchema,
} from '@shared-types';
import {
  optionalString,
  optionalTimestampToIso,
  parseList,
  timestampToIso,
} from './agentFirestoreValues';
import {
  agentThreadMessagesCollection,
  agentThreadRef,
  userCollection,
} from './firestorePaths';

const THREAD_LIST_DEFAULT_LIMIT = 50;
const THREAD_MESSAGES_MAX_RETURNED = 200;
const FALLBACK_THREAD_TITLE = 'Conversation';

export function mapAgentThread(
  id: string,
  data: Record<string, unknown> | undefined,
  userId: string,
  fallbackIso: string,
): IAgentThread {
  const activeTurnId = optionalString(data?.activeTurnId);
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
      timestampToIso(
        data?.updatedAt,
        timestampToIso(data?.createdAt, fallbackIso),
      ),
    ),
    ...(activeTurnId
      ? {
          activeTurnId,
          activeTurnStartedAt: optionalTimestampToIso(
            data?.activeTurnStartedAt,
          ),
        }
      : {}),
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
    ...(thread.activeTurnId
      ? {
          activeTurnId: thread.activeTurnId,
          activeTurnStartedAt: thread.activeTurnStartedAt,
        }
      : {}),
  };
}

export function mapAgentThreadMessage(
  id: string,
  threadId: string,
  data: Record<string, unknown>,
  fallbackIso: string,
): IAgentThreadMessage {
  const promptContext = agentPromptContextSchema.safeParse(data.promptContext);
  const turnStatus = agentMessageTurnStatusSchema.safeParse(data.turnStatus);
  const turnId = optionalString(data.turnId);
  const questions = parseList(data.questions, agentQuestionSchema);
  return {
    id,
    threadId,
    role: data.role === 'assistant' ? 'assistant' : 'user',
    content: typeof data.content === 'string' ? data.content : '',
    createdAt: timestampToIso(data.createdAt, fallbackIso),
    ...(promptContext.success ? { promptContext: promptContext.data } : {}),
    executedActions: parseList(data.executedActions, agentActionResultSchema),
    proposedDeletes: parseList(data.proposedDeletes, agentProposedDeleteSchema),
    referencedItems: parseList(data.referencedItems, agentReferencedItemSchema),
    ...(questions && questions.length > 0 ? { questions } : {}),
    ...(turnId ? { turnId } : {}),
    ...(turnStatus.success ? { turnStatus: turnStatus.data } : {}),
  };
}

/**
 * Most recent messages of a thread, oldest first. Reads newest-first so a long
 * thread returns its latest turns, not its first ones.
 */
export async function listAgentThreadMessages(
  userId: string,
  threadId: string,
  options: {
    maxMessages?: number;
    /** Skip the local cache (it can hold an older transcript after a reconnect). */
    fromServer?: boolean;
  } = {},
): Promise<IAgentThreadMessage[]> {
  const messagesQuery = query(
    agentThreadMessagesCollection(userId, threadId),
    orderBy('createdAt', 'desc'),
    limit(options.maxMessages ?? THREAD_MESSAGES_MAX_RETURNED),
  );
  const messagesSnap = options.fromServer
    ? await getDocsFromServer(messagesQuery)
    : await getDocs(messagesQuery);
  const fallbackIso = new Date().toISOString();
  return messagesSnap.docs
    .map((messageDoc) =>
      mapAgentThreadMessage(
        messageDoc.id,
        threadId,
        messageDoc.data(),
        fallbackIso,
      ),
    )
    .reverse();
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
  const thread = mapAgentThread(
    threadSnap.id,
    threadSnap.data(),
    userId,
    fallbackIso,
  );

  const messages = await listAgentThreadMessages(userId, threadId);
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
    toThreadSummary(
      mapAgentThread(threadDoc.id, threadDoc.data(), userId, fallbackIso),
    ),
  );
}
