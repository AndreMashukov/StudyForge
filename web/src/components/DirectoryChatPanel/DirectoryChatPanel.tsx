import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Spinner } from '../ui/Spinner';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { cn } from '../../lib/utils';
import {
  useGetDirectoryChatQuery,
  useSendDirectoryChatMessageMutation,
} from '../../store/api/DirectoryChat';
import {
  IDirectoryChatMessage,
  IOptimisticDirectoryChatMessage,
} from '../../store/api/DirectoryChat';
import { IDirectoryChatPanel } from './IDirectoryChatPanel';

const MAX_MESSAGE_LENGTH = 4000;

export const DirectoryChatPanel: React.FC<IDirectoryChatPanel> = ({
  directoryId,
  sourceCount = 0,
  className,
  compact = false,
  collapsible = false,
  defaultExpanded,
  expanded,
  onExpandedChange,
  expandable = true,
  seedMessage,
  seedKey,
  artifactContext,
  autoSendSeed = false,
}) => {
  const isControlled = expanded !== undefined;
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(
    defaultExpanded ?? !collapsible,
  );
  const isExpanded = isControlled ? expanded : uncontrolledExpanded;

  const handleExpandedChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setIsPageWide(false);
      }
      if (!isControlled) {
        setUncontrolledExpanded(next);
      }
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  const [isPageWide, setIsPageWide] = useState(false);

  const togglePageWide = useCallback(() => {
    setIsPageWide((prev) => !prev);
  }, []);

  const exitPageWide = useCallback(() => {
    setIsPageWide(false);
  }, []);

  useEffect(() => {
    if (!isPageWide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitPageWide();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPageWide, exitPageWide]);

  const [message, setMessage] = useState('');
  const [visibleMessages, setVisibleMessages] = useState<
    IDirectoryChatMessage[]
  >([]);
  const [optimisticMessages, setOptimisticMessages] = useState<
    IOptimisticDirectoryChatMessage[]
  >([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const sentSeedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error } = useGetDirectoryChatQuery(
    { directoryId },
    { skip: !directoryId },
  );
  const [sendDirectoryChatMessage, { isLoading: isSending }] =
    useSendDirectoryChatMessageMutation();

  const hasLoadError = Boolean(error);
  const effectiveSourceCount = data?.documentCount ?? sourceCount;
  const canChat = effectiveSourceCount > 0;

  useEffect(() => {
    if (data?.messages) {
      setVisibleMessages(data.messages);
    }
  }, [data?.messages]);

  const displayMessages = useMemo<IOptimisticDirectoryChatMessage[]>(
    () => [...visibleMessages, ...optimisticMessages],
    [visibleMessages, optimisticMessages],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [displayMessages.length, isSending]);

  const handleSend = useCallback(
    async (
      nextMessage: string,
      nextSeedKey?: string,
      shouldClearInput = true,
    ) => {
      const trimmed = nextMessage.trim();
      if (!trimmed || !directoryId || !canChat || isSending) return;

      setSendError(null);

      const pendingMessage: IOptimisticDirectoryChatMessage = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
        ...(nextSeedKey ? { seedKey: nextSeedKey } : {}),
        status: 'pending',
      };

      setOptimisticMessages([pendingMessage]);
      if (shouldClearInput) setMessage('');

      try {
        const result = await sendDirectoryChatMessage({
          directoryId,
          message: trimmed,
          ...(nextSeedKey ? { seedKey: nextSeedKey } : {}),
          ...(artifactContext ? { artifactContext } : {}),
        }).unwrap();

        setVisibleMessages(result.messages);
        setOptimisticMessages([]);
      } catch (sendMessageError) {
        const hasErrorMessage = (
          err: unknown,
        ): err is { data: { message: string } } =>
          typeof err === 'object' &&
          err !== null &&
          'data' in err &&
          typeof err.data === 'object' &&
          err.data !== null &&
          'message' in err.data &&
          typeof err.data.message === 'string';

        const errorMessage = hasErrorMessage(sendMessageError)
          ? sendMessageError.data.message
          : 'Failed to send message';

        setOptimisticMessages([{ ...pendingMessage, status: 'failed' }]);
        setSendError(errorMessage);
      }
    },
    [
      artifactContext,
      canChat,
      directoryId,
      isSending,
      sendDirectoryChatMessage,
    ],
  );

  useEffect(() => {
    if (!autoSendSeed || !seedMessage || !seedKey || !canChat || isLoading)
      return;
    if (sentSeedRef.current === seedKey) return;
    if (displayMessages.some((item) => item.seedKey === seedKey)) return;

    sentSeedRef.current = seedKey;
    void handleSend(seedMessage, seedKey, false);
  }, [
    autoSendSeed,
    canChat,
    displayMessages,
    handleSend,
    isLoading,
    seedKey,
    seedMessage,
  ]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSend(message);
  };

  if (collapsible && !isExpanded) {
    return (
      <button
        type="button"
        onClick={() => handleExpandedChange(true)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur transition-colors hover:bg-muted/50',
          className,
        )}
        aria-expanded={false}
        aria-label="Open directory chat"
      >
        <MessageSquare size={18} className="shrink-0 text-primary" />
        <span className="text-sm font-semibold">Chat</span>
        <span className="text-xs text-muted-foreground">
          {effectiveSourceCount}{' '}
          {effectiveSourceCount === 1 ? 'source' : 'sources'}
        </span>
        <ChevronUp size={16} className="ml-1 text-muted-foreground" />
      </button>
    );
  }

  const panelSizeClass = (() => {
    if (isPageWide) {
      return 'fixed inset-4 z-50 h-auto w-auto max-w-none bg-background/95 shadow-2xl backdrop-blur';
    }
    if (collapsible) {
      return 'h-80 w-96';
    }
    if (compact) {
      return 'h-[600px]';
    }
    return 'h-[800px]';
  })();

  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card/40',
        panelSizeClass,
        className,
      )}
      aria-label="Directory chat"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare size={18} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Chat</h2>
            <p className="text-xs text-muted-foreground">
              {effectiveSourceCount}{' '}
              {effectiveSourceCount === 1 ? 'source' : 'sources'} in scope
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isLoading && <Spinner size="xs" />}
          {expandable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={togglePageWide}
              aria-label={
                isPageWide ? 'Exit expanded chat' : 'Expand chat'
              }
              aria-expanded={isPageWide}
            >
              {isPageWide ? (
                <Minimize2 size={16} />
              ) : (
                <Maximize2 size={16} />
              )}
            </Button>
          )}
          {collapsible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleExpandedChange(false)}
              aria-label="Collapse chat"
              aria-expanded={true}
            >
              <ChevronDown size={16} />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {hasLoadError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle size={16} />
            Failed to load chat.
          </div>
        )}

        {!hasLoadError && !canChat && !isLoading && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Add a source to this directory to start chatting.
          </div>
        )}

        {!hasLoadError &&
          canChat &&
          displayMessages.length === 0 &&
          !isLoading && (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Ask about the sources in this directory.
            </div>
          )}

        <div className="space-y-4">
          {displayMessages.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex',
                item.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed',
                  item.role === 'user'
                    ? 'border-primary/30 bg-primary/15 text-foreground'
                    : 'border-border bg-background text-foreground',
                  item.status === 'failed' &&
                    'border-destructive/40 bg-destructive/10',
                )}
              >
                {item.role === 'assistant' ? (
                  <MarkdownRenderer content={item.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{item.content}</p>
                )}
                {item.status === 'pending' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sending...
                  </p>
                )}
                {item.status === 'failed' && (
                  <p className="mt-1 text-xs text-destructive">Not sent</p>
                )}
              </div>
            </div>
          ))}
          {isSending && optimisticMessages.length > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                <Spinner size="xs" />
                Thinking...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      {sendError && (
        <div className="border-t border-border px-4 py-2 text-sm text-destructive">
          {sendError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            canChat
              ? 'Ask about this directory...'
              : 'Add a source before chatting'
          }
          rows={compact ? 2 : 3}
          maxLength={MAX_MESSAGE_LENGTH}
          showCharCount
          disabled={!canChat || isSending}
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!message.trim() || !canChat || isSending}
            className="gap-2"
          >
            {isSending ? (
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
