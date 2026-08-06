import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bot, ChevronDown, Send } from 'lucide-react';
import type { AgentProposedDelete, AgentPromptContext } from '@shared-types';
import {
  agentActionResultSchema,
  agentProposedDeleteSchema,
} from '@shared-types';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Spinner } from '../ui/Spinner';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { stripAgentThinkingContent } from '../../utils/stripAgentThinkingContent';
import { cn } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { baseApi } from '../../store/api/baseApi';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { streamAgentMessage } from '../../services/agentStreamClient';
import { AgentDeleteProposalCard } from './AgentDeleteProposalCard';
import { AgentContextPill, AgentRestoreContextPill } from './AgentContextPill';
import { IAgentChatMessage, IAgentPanel } from './IAgentPanel';
import {
  useAgentLocationContext,
  type AgentLocationContextKind,
} from './useAgentLocationContext';

const MAX_MESSAGE_LENGTH = 10_000;
const GLOBAL_AGENT_THREAD_STORAGE_KEY = 'sf-global-agent-thread-id';
const GLOBAL_AGENT_SESSION_STORAGE_KEY = 'sf-global-agent-session';
/** Matches TopAppBar `h-12` and Sidebar `top-12`. */
const APP_BAR_HEIGHT_PX = 48;
/** Matches Page / Sidebar expanded & collapsed widths. */
const SIDEBAR_EXPANDED_PX = 220;
const SIDEBAR_COLLAPSED_PX = 64;
const PAGE_WIDE_GAP_PX = 16;

const EMPTY_STATE_PROMPTS: Record<AgentLocationContextKind, string[]> = {
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
  document: [
    'Summarize this document',
    'Create a quiz from this document',
    'Explain the key concepts in this document',
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

function readStoredSession(): StoredAgentSession {
  if (typeof window === 'undefined') {
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

function writeStoredSession(session: StoredAgentSession): void {
  if (typeof window === 'undefined') {
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

function promptContextDirectoryId(promptContext: AgentPromptContext | undefined): string | undefined {
  if (!promptContext) {
    return undefined;
  }
  if (promptContext.type === 'directory') {
    return promptContext.directoryId;
  }
  return promptContext.directoryId;
}

export const AgentPanel: React.FC<IAgentPanel> = ({
  scope = 'workspace',
  directoryId,
  onMutated,
  onClose,
  variant = 'embedded',
  className,
}) => {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [messages, setMessages] = useState<IAgentChatMessage[]>(() => storedSession.messages);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>(() => storedSession.threadId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dispatch = useAppDispatch();
  const sidebarIsOpen = useAppSelector(selectSidebarIsOpen);
  const { isAppFullscreen } = useAppFullscreen();
  const isOverlay = variant === 'overlay';
  const locationContext = useAgentLocationContext();

  const activePromptContext = contextDismissed ? undefined : locationContext?.promptContext;
  const suggestionKind: AgentLocationContextKind = activePromptContext?.type ?? 'workspace';

  useEffect(() => {
    if (!isOverlay) {
      return;
    }
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isOverlay]);

  const pageWideStyle = useMemo(() => {
    if (!isOverlay) {
      return undefined;
    }
    const sidebarWidth = sidebarIsOpen ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX;
    const contentLeft = !isMobile && !isAppFullscreen ? sidebarWidth : 0;
    const contentTop = isAppFullscreen ? 0 : APP_BAR_HEIGHT_PX;
    return {
      top: contentTop + PAGE_WIDE_GAP_PX,
      left: contentLeft + PAGE_WIDE_GAP_PX,
      right: PAGE_WIDE_GAP_PX,
      bottom: PAGE_WIDE_GAP_PX,
    };
  }, [isAppFullscreen, isMobile, isOverlay, sidebarIsOpen]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const sessionRef = useRef<StoredAgentSession>({ threadId, messages });
  sessionRef.current = { threadId, messages };

  // Persist continuously, including mid-stream, so close/reopen keeps history.
  useEffect(() => {
    writeStoredSession({
      threadId,
      messages: messages.map((message) => ({
        ...message,
        isStreaming: false,
      })),
    });
  }, [threadId, messages]);

  useEffect(() => {
    return () => {
      const latest = sessionRef.current;
      writeStoredSession({
        threadId: latest.threadId,
        messages: latest.messages.map((message) => ({
          ...message,
          isStreaming: false,
          statusMessage: message.isStreaming
            ? (message.statusMessage ?? 'Interrupted')
            : message.statusMessage,
        })),
      });
      abortRef.current?.abort();
    };
  }, []);

  const handleDeleteProposalConfirmed = useCallback(
    (proposal: AgentProposedDelete) => {
      setMessages((current) =>
        current.map((message) => {
          if (!message.proposedDeletes?.length) {
            return message;
          }

          const nextProposals = message.proposedDeletes.filter(
            (entry) =>
              !(
                entry.targetType === proposal.targetType &&
                entry.targetId === proposal.targetId
              )
          );

          if (nextProposals.length === message.proposedDeletes.length) {
            return message;
          }

          return {
            ...message,
            proposedDeletes:
              nextProposals.length > 0 ? nextProposals : undefined,
          };
        })
      );
      onMutated?.();
    },
    [onMutated]
  );

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
      const hintDirectoryId =
        promptContextDirectoryId(activePromptContext) ?? directoryId;

      try {
        await streamAgentMessage(
          {
            scope,
            directoryId: hintDirectoryId,
            message: trimmed,
            threadId,
            promptContext: activePromptContext,
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
                          content: stripAgentThinkingContent(
                            `${message.content}${event.text}`,
                          ),
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
                setMessages((current) =>
                  current.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          isStreaming: false,
                          statusMessage: undefined,
                        }
                      : message,
                  ),
                );
              }
            },
          },
        );
      } catch (sendError) {
        if (controller.signal.aborted) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    isStreaming: false,
                    statusMessage: undefined,
                    content:
                      message.content.trim().length > 0
                        ? message.content
                        : 'Request cancelled.',
                  }
                : message,
            ),
          );
          return;
        }
        const message =
          sendError instanceof Error ? sendError.message : 'Failed to send message';
        setError(message);
        setMessages((current) => current.filter((entry) => entry.id !== assistantId));
      } finally {
        setLoading(false);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && message.isStreaming
              ? { ...message, isStreaming: false }
              : message,
          ),
        );
        dispatch(baseApi.util.invalidateTags(['UsageSummary']));
        if (didMutate) {
          onMutated?.();
        }
      }
    },
    [activePromptContext, directoryId, dispatch, loading, onMutated, scope, threadId],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card/40',
        isOverlay
          ? 'fixed z-50 h-auto w-auto max-w-none bg-background/95 shadow-2xl backdrop-blur transition-[top,left] duration-300'
          : 'h-[800px]',
        className,
      )}
      style={pageWideStyle}
      aria-label="StudyForge agent"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-base font-semibold">Agent</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loading ? <Spinner size="xs" /> : null}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Collapse agent"
              aria-expanded={true}
            >
              <ChevronDown size={16} />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Ask about your workspace, create content, or run StudyForge actions with tools.
            </div>
            <div className="flex flex-wrap gap-2">
              {EMPTY_STATE_PROMPTS[suggestionKind].map((prompt) => (
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
            {messages.map((message) => {
              const isStreamingEmpty =
                message.role === 'assistant' &&
                message.isStreaming &&
                !message.content;

              if (isStreamingEmpty) {
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                      <Spinner size="xs" />
                      {message.statusMessage ?? 'Thinking...'}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'border-primary/30 bg-primary/15 text-foreground'
                        : 'border-border bg-background text-foreground',
                    )}
                  >
                    {message.role === 'assistant' &&
                    message.isStreaming &&
                    message.statusMessage ? (
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Spinner size="xs" />
                        <span>{message.statusMessage}</span>
                      </div>
                    ) : null}

                    {message.role === 'assistant' ? (
                      message.content.trim().length > 0 ? (
                        <MarkdownRenderer
                          content={stripAgentThinkingContent(message.content)}
                          className="[&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0 [&_ol:last-child]:!mb-0 [&_blockquote:last-child]:!mb-0 [&_>div:last-child]:!mb-0"
                        />
                      ) : message.isStreaming ? null : (
                        <p className="text-muted-foreground">No response text.</p>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.executedActions && message.executedActions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.executedActions.map((action, index) => (
                          <span
                            key={`${message.id}-action-${index}`}
                            className="rounded-full border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
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
                            onConfirmed={() => handleDeleteProposalConfirmed(proposal)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-border px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder="Ask the agent..."
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          showCharCount
          disabled={loading}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {locationContext && !contextDismissed ? (
              <AgentContextPill
                locationContext={locationContext}
                onRemove={() => setContextDismissed(true)}
                disabled={loading}
              />
            ) : null}
            {locationContext && contextDismissed ? (
              <AgentRestoreContextPill
                onRestore={() => setContextDismissed(false)}
                disabled={loading}
              />
            ) : null}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="gap-2"
          >
            {loading ? (
              <Spinner size="xs" variant="on-primary" />
            ) : (
              <Send size={14} />
            )}
            Send
          </Button>
        </div>
      </form>
    </section>
  );
};
