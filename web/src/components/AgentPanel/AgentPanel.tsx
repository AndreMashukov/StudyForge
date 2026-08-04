import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Loader2, Send, X } from 'lucide-react';
import type { AgentScope } from '@shared-types';
import {
  agentActionResultSchema,
  agentProposedDeleteSchema,
} from '@shared-types';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { cn } from '../../lib/utils';
import { streamAgentMessage } from '../../services/agentStreamClient';
import { extractDirectoryIdFromRouteParam } from '../../utils/directoryUrl';
import { AgentDeleteProposalCard } from './AgentDeleteProposalCard';
import { IAgentChatMessage, IAgentPanel } from './IAgentPanel';

const MAX_MESSAGE_LENGTH = 10_000;
const GLOBAL_AGENT_THREAD_STORAGE_KEY = 'sf-global-agent-thread-id';
const GLOBAL_AGENT_SESSION_STORAGE_KEY = 'sf-global-agent-session';

const EMPTY_STATE_PROMPTS: Record<AgentScope, string[]> = {
  workspace: [
    'List all my directories and documents',
    'Search my knowledge for machine learning notes',
    'Create a study folder with a summary document',
  ],
  directory: [
    'Summarize the sources in this folder',
    'Create a subfolder called Research',
    'Generate a quiz from the latest document',
  ],
};

type StoredAgentSession = {
  threadId?: string;
  messages: IAgentChatMessage[];
};

const storedAgentMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  executedActions: z.array(agentActionResultSchema).optional(),
  proposedDeletes: z.array(agentProposedDeleteSchema).optional(),
  statusMessage: z.string().optional(),
  isStreaming: z.boolean().optional(),
});

const storedAgentSessionSchema = z.object({
  threadId: z.string().optional(),
  messages: z.array(storedAgentMessageSchema),
});

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStoredSession(scope: AgentScope): StoredAgentSession {
  if (scope !== 'workspace' || typeof window === 'undefined') {
    return { messages: [] };
  }

  try {
    const storedSession = window.sessionStorage.getItem(GLOBAL_AGENT_SESSION_STORAGE_KEY);
    if (storedSession) {
      const parsed = storedAgentSessionSchema.safeParse(JSON.parse(storedSession));
      if (parsed.success) {
        return {
          threadId: parsed.data.threadId,
          messages: parsed.data.messages.map((message) => ({
            ...message,
            isStreaming: false,
          })),
        };
      }
    }

    const legacyThreadId = window.sessionStorage.getItem(GLOBAL_AGENT_THREAD_STORAGE_KEY);
    return {
      threadId: legacyThreadId && legacyThreadId.trim().length > 0 ? legacyThreadId : undefined,
      messages: [],
    };
  } catch {
    return { messages: [] };
  }
}

function writeStoredSession(scope: AgentScope, session: StoredAgentSession): void {
  if (scope !== 'workspace' || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(GLOBAL_AGENT_SESSION_STORAGE_KEY, JSON.stringify(session));
    if (session.threadId) {
      window.sessionStorage.setItem(GLOBAL_AGENT_THREAD_STORAGE_KEY, session.threadId);
    } else {
      window.sessionStorage.removeItem(GLOBAL_AGENT_THREAD_STORAGE_KEY);
    }
  } catch {
    // Ignore restricted storage contexts.
  }
}

function directoryIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/^\/directory\/([^/?#]+)/);
  if (!match?.[1]) {
    return undefined;
  }
  return extractDirectoryIdFromRouteParam(match[1]) ?? undefined;
}

export const AgentPanel: React.FC<IAgentPanel> = ({
  scope = 'workspace',
  directoryId,
  onMutated,
  onClose,
  variant = 'embedded',
}) => {
  const storedSession = useMemo(() => readStoredSession(scope), [scope]);
  const [messages, setMessages] = useState<IAgentChatMessage[]>(() => storedSession.messages);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>(() => storedSession.threadId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const subtitle =
    scope === 'workspace'
      ? 'Search, create, update, and organize content across your workspace.'
      : 'Search, create, update, and organize content in this folder.';

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const isStreamingMessages = messages.some((message) => message.isStreaming);

  useEffect(() => {
    if (isStreamingMessages) {
      return;
    }
    writeStoredSession(scope, { threadId, messages });
  }, [scope, threadId, messages, isStreamingMessages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim();
      if (!trimmed || loading) {
        return;
      }

      setError(null);
      setLoading(true);

      const userMessage: IAgentChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = createMessageId();
      const assistantPlaceholder: IAgentChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        executedActions: [],
        proposedDeletes: [],
        statusMessage: 'Thinking...',
      };

      setMessages((current) => [...current, userMessage, assistantPlaceholder]);
      setInput('');

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let didMutate = false;

      try {
        await streamAgentMessage(
          {
            scope,
            directoryId,
            message: trimmed,
            threadId,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === 'thread') {
                setThreadId(event.threadId);
              }

              if (event.type === 'status') {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? { ...message, statusMessage: event.message }
                      : message,
                  ),
                );
              }

              if (event.type === 'delta') {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          content: `${message.content}${event.text}`,
                          statusMessage: undefined,
                        }
                      : message,
                  ),
                );
              }

              if (event.type === 'action') {
                didMutate = true;
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          executedActions: [
                            ...(message.executedActions ?? []),
                            event.action,
                          ],
                        }
                      : message,
                  ),
                );
              }

              if (event.type === 'delete_proposal') {
                didMutate = true;
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          proposedDeletes: [
                            ...(message.proposedDeletes ?? []),
                            event.proposal,
                          ],
                        }
                      : message,
                  ),
                );
              }

              if (event.type === 'done') {
                setThreadId(event.response.threadId);
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          content: event.response.reply,
                          executedActions: event.response.executedActions,
                          proposedDeletes: event.response.proposedDeletes,
                          isStreaming: false,
                          statusMessage: undefined,
                        }
                      : message,
                  ),
                );
              }

              if (event.type === 'error') {
                setError(event.message);
              }
            },
          },
        );
      } catch (sendError) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          sendError instanceof Error ? sendError.message : 'Failed to send message';
        setError(message);
        setMessages((current) => current.filter((entry) => entry.id !== assistantId));
      } finally {
        setLoading(false);
        if (didMutate) {
          onMutated?.();
        }
      }
    },
    [directoryId, loading, onMutated, scope, threadId],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl',
        variant === 'overlay' && 'agent-panel-overlay',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">StudyForge Agent</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close agent">
            <X size={16} />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about your workspace, create content, or run StudyForge actions with tools.
            </p>
            <div className="flex flex-wrap gap-2">
              {EMPTY_STATE_PROMPTS[scope].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'ml-8 bg-primary/15 text-foreground'
                    : 'mr-8 bg-muted/40 text-foreground',
                )}
              >
                {message.role === 'assistant' ? (
                  message.content ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      <span>{message.statusMessage ?? 'Thinking...'}</span>
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                {message.executedActions && message.executedActions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.executedActions.map((action, index) => (
                      <span
                        key={`${message.id}-action-${index}`}
                        className="rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground"
                      >
                        {action.summary}
                      </span>
                    ))}
                  </div>
                ) : null}

                {message.proposedDeletes && message.proposedDeletes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {message.proposedDeletes.map((proposal) => (
                      <AgentDeleteProposalCard
                        key={`${proposal.targetType}-${proposal.targetId}`}
                        proposal={proposal}
                        onConfirmed={() => onMutated?.()}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-border px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <form
        className="border-t border-border px-4 py-3"
        onSubmit={handleSubmit}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Ask the agent..."
            rows={2}
            className="min-h-[72px] flex-1 resize-none"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} aria-label="Send message">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </form>
    </div>
  );
};

export function useAgentDirectoryContext(): string | undefined {
  const { pathname } = useLocation();
  return directoryIdFromPathname(pathname);
}
