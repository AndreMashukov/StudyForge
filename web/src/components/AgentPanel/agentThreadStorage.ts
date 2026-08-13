import { z } from 'zod';
import {
  agentActionResultSchema,
  agentProposedDeleteSchema,
} from '@shared-types';
import { IAgentChatMessage } from './IAgentPanel';

const ACTIVE_THREAD_STORAGE_KEY = 'sf-global-agent-active-thread-id';
const LEGACY_SESSION_THREAD_KEY = 'sf-global-agent-thread-id';
const LEGACY_SESSION_MESSAGES_KEY = 'sf-global-agent-session';
const STREAM_BACKUP_KEY = 'sf-global-agent-stream-backup';

const storedAgentMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  executedActions: z.array(agentActionResultSchema).optional(),
  proposedDeletes: z.array(agentProposedDeleteSchema).optional(),
  statusMessage: z.string().optional(),
  isStreaming: z.boolean().optional(),
});

const streamBackupSchema = z.object({
  threadId: z.string().optional(),
  messages: z.array(storedAgentMessageSchema),
});

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function readActiveThreadId(): string | undefined {
  if (!canUseStorage()) {
    return undefined;
  }

  try {
    const fromLocal = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
    if (fromLocal && fromLocal.trim().length > 0) {
      return fromLocal.trim();
    }

    const fromSession = window.sessionStorage.getItem(
      LEGACY_SESSION_THREAD_KEY,
    );
    if (fromSession && fromSession.trim().length > 0) {
      const threadId = fromSession.trim();
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
      window.sessionStorage.removeItem(LEGACY_SESSION_THREAD_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY);
      return threadId;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function writeActiveThreadId(threadId: string | undefined): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (threadId && threadId.trim().length > 0) {
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId.trim());
    } else {
      window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    }
    window.sessionStorage.removeItem(LEGACY_SESSION_THREAD_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY);
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function writeStreamBackup(
  threadId: string | undefined,
  messages: IAgentChatMessage[],
): void {
  if (!canUseStorage()) {
    return;
  }

  const hasStreaming = messages.some((message) => message.isStreaming);
  try {
    if (!hasStreaming) {
      window.sessionStorage.removeItem(STREAM_BACKUP_KEY);
      return;
    }

    window.sessionStorage.setItem(
      STREAM_BACKUP_KEY,
      JSON.stringify({
        threadId,
        messages: messages.map((message) => ({
          ...message,
          isStreaming: Boolean(message.isStreaming),
        })),
      }),
    );
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function consumeStreamBackup(
  threadId: string | undefined,
): IAgentChatMessage[] | undefined {
  if (!canUseStorage() || !threadId) {
    return undefined;
  }

  try {
    const raw = window.sessionStorage.getItem(STREAM_BACKUP_KEY);
    window.sessionStorage.removeItem(STREAM_BACKUP_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = streamBackupSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.threadId !== threadId) {
      return undefined;
    }

    return parsed.data.messages.map((message) => ({
      ...message,
      isStreaming: false,
      statusMessage: message.isStreaming
        ? (message.statusMessage ?? 'Interrupted')
        : message.statusMessage,
    }));
  } catch {
    return undefined;
  }
}

export function clearStreamBackup(): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(STREAM_BACKUP_KEY);
  } catch {
    // Ignore restricted storage contexts.
  }
}
