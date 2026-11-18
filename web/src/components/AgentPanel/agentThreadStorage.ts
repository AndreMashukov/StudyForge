import { z } from 'zod';
import type { AgentScope, IAgentThread } from '@shared-types';

const ACTIVE_THREAD_STORAGE_KEY = 'sf-global-agent-active-thread-id';
const LEGACY_SESSION_THREAD_KEY = 'sf-global-agent-thread-id';
const LEGACY_SESSION_MESSAGES_KEY = 'sf-global-agent-session';
/** Retired: agent turns are durable now, so in-flight replies need no backup. */
const LEGACY_STREAM_BACKUP_KEY = 'sf-global-agent-stream-backup';
const WORKSPACE_CONTEXT_KEY = 'workspace';

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

function persistActiveThreadMap(
  userId: string,
  nextMap: Record<string, string>,
): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    const scopedKey = `${ACTIVE_THREAD_STORAGE_KEY}:${userId}`;
    if (Object.keys(nextMap).length === 0) {
      window.localStorage.removeItem(scopedKey);
    } else {
      window.localStorage.setItem(scopedKey, JSON.stringify(nextMap));
    }
    window.sessionStorage.removeItem(LEGACY_SESSION_THREAD_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY);
    window.sessionStorage.removeItem(LEGACY_STREAM_BACKUP_KEY);
  } catch {
    // Ignore restricted storage contexts.
  }
}

function readActiveThreadMapForUser(userId: string): Record<string, string> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const scoped = window.localStorage.getItem(
      `${ACTIVE_THREAD_STORAGE_KEY}:${userId}`,
    );
    if (scoped && scoped.trim().length > 0) {
      return parseActiveThreadMap(scoped);
    }
  } catch {
    return {};
  }

  return {};
}

export function readActiveThreadId(
  userId: string | undefined,
  scope: AgentScope,
  directoryId?: string,
): string | undefined {
  if (!userId) {
    return undefined;
  }
  const contextKey = agentPanelContextKey(scope, directoryId);
  const threadId = readActiveThreadMapForUser(userId)[contextKey];
  return threadId && threadId.trim().length > 0 ? threadId.trim() : undefined;
}

export function writeActiveThreadId(
  userId: string | undefined,
  threadId: string | undefined,
  scope: AgentScope,
  directoryId?: string,
): void {
  if (!userId) {
    return;
  }
  const contextKey = agentPanelContextKey(scope, directoryId);
  const nextMap = { ...readActiveThreadMapForUser(userId) };

  if (threadId && threadId.trim().length > 0) {
    nextMap[contextKey] = threadId.trim();
  } else {
    delete nextMap[contextKey];
  }

  persistActiveThreadMap(userId, nextMap);
}
