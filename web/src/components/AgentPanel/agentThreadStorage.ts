import { z } from 'zod';
import type { AgentScope, IAgentThread } from '@shared-types';
import {
  agentActionResultSchema,
  agentProposedDeleteSchema,
} from '@shared-types';
import { IAgentChatMessage } from './IAgentPanel';

const ACTIVE_THREAD_STORAGE_KEY = 'sf-global-agent-active-thread-id';
const LEGACY_SESSION_THREAD_KEY = 'sf-global-agent-thread-id';
const LEGACY_SESSION_MESSAGES_KEY = 'sf-global-agent-session';
const STREAM_BACKUP_KEY = 'sf-global-agent-stream-backup';
const WORKSPACE_CONTEXT_KEY = 'workspace';

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

const activeThreadMapSchema = z.record(z.string().min(1), z.string().min(1));

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function agentPanelContextKey(
  scope: AgentScope,
  directoryId?: string,
): string {
  if (scope === 'directory' && directoryId) {
    return `directory:${directoryId}`;
  }
  return WORKSPACE_CONTEXT_KEY;
}

export function threadMatchesPanelContext(
  thread: Pick<IAgentThread, 'scope' | 'directoryId'>,
  scope: AgentScope,
  directoryId?: string,
): boolean {
  if (scope === 'directory') {
    return thread.scope === 'directory' && thread.directoryId === directoryId;
  }
  return thread.scope === 'workspace';
}

function parseActiveThreadMap(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  if (!trimmed.startsWith('{')) {
    return { [WORKSPACE_CONTEXT_KEY]: trimmed };
  }

  try {
    const parsed = activeThreadMapSchema.safeParse(JSON.parse(trimmed));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function readActiveThreadMap(): Record<string, string> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const fromLocal = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
    if (fromLocal && fromLocal.trim().length > 0) {
      return parseActiveThreadMap(fromLocal);
    }

    const fromSession = window.sessionStorage.getItem(
      LEGACY_SESSION_THREAD_KEY,
    );
    if (fromSession && fromSession.trim().length > 0) {
      const threadId = fromSession.trim();
      const nextMap = { [WORKSPACE_CONTEXT_KEY]: threadId };
      window.localStorage.setItem(
        ACTIVE_THREAD_STORAGE_KEY,
        JSON.stringify(nextMap),
      );
      window.sessionStorage.removeItem(LEGACY_SESSION_THREAD_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY);
      return nextMap;
    }
  } catch {
    return {};
  }

  return {};
}

function persistActiveThreadMap(nextMap: Record<string, string>): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (Object.keys(nextMap).length === 0) {
      window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_THREAD_STORAGE_KEY,
        JSON.stringify(nextMap),
      );
    }
    window.sessionStorage.removeItem(LEGACY_SESSION_THREAD_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY);
  } catch {
    // Ignore restricted storage contexts.
  }
}

export function readActiveThreadId(
  scope: AgentScope,
  directoryId?: string,
): string | undefined {
  const contextKey = agentPanelContextKey(scope, directoryId);
  const threadId = readActiveThreadMap()[contextKey];
  return threadId && threadId.trim().length > 0 ? threadId.trim() : undefined;
}

export function writeActiveThreadId(
  threadId: string | undefined,
  scope: AgentScope,
  directoryId?: string,
): void {
  const contextKey = agentPanelContextKey(scope, directoryId);
  const nextMap = { ...readActiveThreadMap() };

  if (threadId && threadId.trim().length > 0) {
    nextMap[contextKey] = threadId.trim();
  } else {
    delete nextMap[contextKey];
  }

  persistActiveThreadMap(nextMap);
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
