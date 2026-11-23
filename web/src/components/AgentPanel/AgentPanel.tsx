import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, Send, Square } from 'lucide-react';
import type { AgentProposedDelete } from '@shared-types';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/redux';
import { selectSidebarIsOpen } from '../../store/slices/uiSlice';
import { useAppFullscreen } from '../../contexts/FullscreenContext';
import { useListAgentThreadsQuery } from '../../store/api/AgentThread';
import { AgentChatMessage } from './AgentChatMessage';
import { AgentQuestionCard } from './AgentQuestionCard';
import { findOpenAgentQuestions } from '../../services/agentConversation';
import { AgentContextPill, AgentRestoreContextPill } from './AgentContextPill';
import { AgentThreadHistoryMenu } from './AgentThreadHistoryMenu';
import { IAgentPanel } from './IAgentPanel';
import { isAgentThreadMissingError } from './agentPanelErrors';
import {
  useAgentConversation,
  type IAgentPendingTurn,
} from './hooks/useAgentConversation';
import { useAgentPanelEffects } from './hooks/useAgentPanelEffects';
import { useAgentPanelHandlers } from './hooks/useAgentPanelHandlers';
import { useAgentPanelThread } from './hooks/useAgentPanelThread';
import { useIsMobileOverlay } from './hooks/useIsMobileOverlay';
import {
  useAgentLocationContext,
  type AgentLocationContextKind,
} from './useAgentLocationContext';

const MAX_MESSAGE_LENGTH = 10_000;
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
  rule: [
    'Summarize this rule',
    'Improve this rule for clarity',
    'Where is this rule applied?',
  ],
};

function deleteProposalKey(
  entryId: string,
  proposal: Pick<AgentProposedDelete, 'targetType' | 'targetId'>,
): string {
  return `${entryId}:${proposal.targetType}:${proposal.targetId}`;
}

/**
 * Agent chat panel. Replies are durable agent turns (ADR 010): they run on
 * the server, so collapsing the panel, changing page or closing the tab never
 * stops one, and reopening re-attaches to it. Only Stop cancels.
 */
export const AgentPanel: React.FC<IAgentPanel> = ({
  scope = 'workspace',
  directoryId,
  onMutated,
  onClose,
  variant = 'embedded',
  className,
  initialInput,
  pinnedThreadId,
}) => {
  const { user } = useAuth();
  const userId = user?.uid;
  const [input, setInput] = useState(initialInput ?? '');
  const [error, setError] = useState<string | null>(null);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<IAgentPendingTurn | null>(
    null,
  );
  const [dismissedQuestionsId, setDismissedQuestionsId] = useState<
    string | null
  >(null);
  const [confirmedDeleteKeys, setConfirmedDeleteKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sidebarIsOpen = useAppSelector(selectSidebarIsOpen);
  const { isAppFullscreen } = useAppFullscreen();
  const isOverlay = variant === 'overlay';
  const isMobile = useIsMobileOverlay(isOverlay);
  const locationContext = useAgentLocationContext();

  const { threadId, selectThread, rememberThread } = useAgentPanelThread({
    userId,
    scope,
    directoryId,
    pinnedThreadId,
  });
  const { data: threadListData, isLoading: isThreadListLoading } =
    useListAgentThreadsQuery({});
  const { entries, threadData, threadError, isThreadLoading, turn, isWorking } =
    useAgentConversation({ threadId, pendingTurn });

  const activePromptContext = contextDismissed
    ? undefined
    : locationContext?.promptContext;
  const suggestionKind: AgentLocationContextKind =
    activePromptContext?.type ?? 'workspace';

  const clearPendingTurn = useCallback((turnId: string) => {
    setPendingTurn((current) => (current?.turnId === turnId ? null : current));
  }, []);

  useAgentPanelEffects({
    scope,
    directoryId,
    threadId,
    threadData,
    threadError,
    turn,
    entries,
    pendingTurn,
    scrollRef,
    selectThread,
    clearPendingTurn,
    onMutated,
  });

  const {
    handleSend,
    handleStop,
    handleNewChat,
    handleSelectThread,
    isStopping,
  } = useAgentPanelHandlers({
    scope,
    directoryId,
    threadId,
    activePromptContext,
    turn,
    isWorking,
    selectThread,
    rememberThread,
    setPendingTurn,
    setInput,
    setError,
  });

  const handleDeleteProposalConfirmed = useCallback(
    (entryId: string, proposal: AgentProposedDelete) => {
      setConfirmedDeleteKeys((current) => {
        const next = new Set(current);
        next.add(deleteProposalKey(entryId, proposal));
        return next;
      });
      onMutated?.();
    },
    [onMutated],
  );

  const visibleThreads = useMemo(() => {
    const threads = threadListData?.threads ?? [];
    if (scope === 'directory') {
      return threads.filter(
        (thread) =>
          thread.scope === 'directory' && thread.directoryId === directoryId,
      );
    }
    return threads.filter((thread) => thread.scope === 'workspace');
  }, [directoryId, scope, threadListData?.threads]);

  const pageWideStyle = useMemo(() => {
    if (!isOverlay) {
      return undefined;
    }
    const sidebarWidth = sidebarIsOpen
      ? SIDEBAR_EXPANDED_PX
      : SIDEBAR_COLLAPSED_PX;
    const contentLeft = !isMobile && !isAppFullscreen ? sidebarWidth : 0;
    const contentTop = isAppFullscreen ? 0 : APP_BAR_HEIGHT_PX;
    return {
      top: contentTop + PAGE_WIDE_GAP_PX,
      left: contentLeft + PAGE_WIDE_GAP_PX,
      right: PAGE_WIDE_GAP_PX,
      bottom: PAGE_WIDE_GAP_PX,
    };
  }, [isAppFullscreen, isMobile, isOverlay, sidebarIsOpen]);

  const openQuestions = useMemo(
    () => findOpenAgentQuestions(entries),
    [entries],
  );
  const visibleQuestions =
    openQuestions && openQuestions.entryId !== dismissedQuestionsId
      ? openQuestions
      : null;

  const canStop =
    Boolean(turn) && isWorking && !turn?.cancelRequested && !isStopping;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSend(input);
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
          {pinnedThreadId ? null : (
            <AgentThreadHistoryMenu
              threads={visibleThreads}
              activeThreadId={threadId}
              isLoading={isThreadListLoading}
              disabled={false}
              onSelectThread={handleSelectThread}
              onNewChat={handleNewChat}
            />
          )}
          {isWorking ? <Spinner size="xs" /> : null}
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
        {threadId &&
        entries.length === 0 &&
        !isAgentThreadMissingError(threadError) &&
        (isThreadLoading || threadData?.thread.id === threadId) ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Spinner size="xs" />
            Loading conversation...
          </div>
        ) : threadError && !isAgentThreadMissingError(threadError) ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load conversation.
          </div>
        ) : entries.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Ask about your workspace, create content, or run StudyForge
              actions with tools.
            </div>
            <div className="flex flex-wrap gap-2">
              {EMPTY_STATE_PROMPTS[suggestionKind].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => void handleSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <AgentChatMessage
                key={entry.id}
                entry={entry}
                proposedDeletes={entry.proposedDeletes.filter(
                  (proposal) =>
                    !confirmedDeleteKeys.has(
                      deleteProposalKey(entry.id, proposal),
                    ),
                )}
                onDeleteConfirmed={(proposal) =>
                  handleDeleteProposalConfirmed(entry.id, proposal)
                }
              />
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-border px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="border-t border-border">
        {visibleQuestions ? (
          <AgentQuestionCard
            key={visibleQuestions.entryId}
            questions={visibleQuestions.questions}
            disabled={isWorking}
            onSubmit={(message) =>
              void handleSend(message, { fromQuestionCard: true })
            }
            onDismiss={() => setDismissedQuestionsId(visibleQuestions.entryId)}
          />
        ) : null}

        <form onSubmit={handleSubmit} className="p-3">
          <Textarea
            value={input}
            onChange={(event) =>
              setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            placeholder={
              visibleQuestions
                ? 'Or reply in your own words...'
                : 'Ask the agent...'
            }
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            showCharCount
            disabled={isWorking}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {locationContext && !contextDismissed ? (
                <AgentContextPill
                  locationContext={locationContext}
                  onRemove={() => setContextDismissed(true)}
                  disabled={isWorking}
                />
              ) : null}
              {locationContext && contextDismissed ? (
                <AgentRestoreContextPill
                  onRestore={() => setContextDismissed(false)}
                  disabled={isWorking}
                />
              ) : null}
            </div>
            {isWorking ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canStop}
                className="gap-2"
                onClick={() => void handleStop()}
                aria-label="Stop the agent"
              >
                <Square size={14} />
                {turn?.cancelRequested || isStopping ? 'Stopping...' : 'Stop'}
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim()}
                className="gap-2"
              >
                <Send size={14} />
                Send
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
};
