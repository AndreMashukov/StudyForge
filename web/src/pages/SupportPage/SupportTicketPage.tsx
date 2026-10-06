import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import {
  formatMessageAuthor,
  formatSupportCategory,
  formatSupportWhen,
  ticketSortTimestamp,
} from './supportFormat';
import {
  listenSupportTicket,
  listenTicketMessages,
  submitSupportCommand,
  type SupportThreadMessage,
  type SupportTicket,
} from './supportFirestore';

type TicketLocationState = {
  justCreated?: boolean;
};

function mergeThreadMessages(
  messages: SupportThreadMessage[],
  pendingBody: string | null,
): SupportThreadMessage[] {
  if (!pendingBody) {
    return messages;
  }
  const trimmed = pendingBody.trim();
  const hasReal = messages.some(
    (message) =>
      message.authorType === 'user' && message.body.trim() === trimmed,
  );
  if (hasReal) {
    return messages;
  }
  return [
    ...messages,
    {
      id: '__pending__',
      authorType: 'user',
      body: trimmed,
      createdAt: null,
      pending: true,
    },
  ];
}

function buildHowItWorksDisplayMessages(
  messages: SupportThreadMessage[],
  pendingBody: string | null,
  ticket: SupportTicket | null,
): SupportThreadMessage[] {
  let merged = mergeThreadMessages(messages, pendingBody);
  if (!ticket) {
    return merged;
  }
  const title = ticket.title.trim();
  if (!title) {
    return merged;
  }
  const hasUserWithTitle = merged.some(
    (message) =>
      message.authorType === 'user' && message.body.trim() === title,
  );
  if (!hasUserWithTitle) {
    merged = [
      {
        id: '__initial__',
        authorType: 'user',
        body: title,
        createdAt: ticket.createdAt,
      },
      ...merged,
    ];
  }
  return merged;
}

function isAssistantMessage(authorType: string): boolean {
  return authorType === 'system' || authorType === 'staff';
}

export const SupportTicketPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const justCreatedFromNav = Boolean(
    (location.state as TicketLocationState | null)?.justCreated,
  );
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportThreadMessage[]>([]);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    return listenSupportTicket(ticketId, setTicket);
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId || !ticket) {
      setMessages([]);
      return;
    }
    return listenTicketMessages(ticketId, setMessages);
  }, [ticketId, ticket]);

  useEffect(() => {
    if (!pendingBody) {
      return;
    }
    const matched = messages.some(
      (message) =>
        message.authorType === 'user' &&
        message.body.trim() === pendingBody.trim(),
    );
    if (matched) {
      setPendingBody(null);
    }
  }, [messages, pendingBody]);

  const isHowItWorks = ticket?.category === 'how_it_works';
  const showSubmittedBanner =
    justCreatedFromNav && ticket != null && !isHowItWorks;

  const threadMessages = useMemo(() => {
    if (isHowItWorks) {
      return buildHowItWorksDisplayMessages(messages, pendingBody, ticket);
    }
    return mergeThreadMessages(messages, pendingBody);
  }, [isHowItWorks, messages, pendingBody, ticket]);

  const awaitingAssistant =
    isHowItWorks &&
    ticket?.status === 'open' &&
    (threadMessages.length === 0 ||
      threadMessages[threadMessages.length - 1]?.authorType === 'user' ||
      Boolean(threadMessages[threadMessages.length - 1]?.pending));

  const isOpen = ticket?.status === 'open';
  const activityAt = ticket
    ? ticketSortTimestamp(ticket.updatedAt, ticket.createdAt)
    : '';

  const onSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.uid || !user.email || !ticketId || !body.trim() || !isOpen) {
      return;
    }
    const trimmed = body.trim();
    setPending(true);
    setError(null);
    try {
      await submitSupportCommand({
        type: 'AppendMessage',
        userId: user.uid,
        userEmail: user.email,
        payload: { ticketId, body: trimmed },
      });
      setPendingBody(trimmed);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setPending(false);
    }
  };

  return (
    <Page showSidebar={true}>
      <div className="mx-auto flex max-w-3xl flex-col px-4 pt-6 pb-10">
        <p className="mb-6">
          <Link className="text-sm underline" to="/support">
            Back to Support
          </Link>
        </p>

        {showSubmittedBanner ? (
          <p
            className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
            data-testid="support-ticket-submitted"
          >
            Ticket submitted. We usually reply within a few hours.
          </p>
        ) : null}

        {ticket ? (
          <header className="mb-6 space-y-2 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {!isHowItWorks ? (
                <Badge variant={isOpen ? 'default' : 'secondary'}>
                  {ticket.status}
                </Badge>
              ) : null}
              <Badge variant="outline">
                {formatSupportCategory(ticket.category)}
              </Badge>
              {activityAt ? (
                <span className="text-sm text-muted-foreground">
                  Updated {formatSupportWhen(activityAt)}
                </span>
              ) : null}
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {ticket.title}
            </h1>
          </header>
        ) : (
          <h1 className="mb-6 font-heading text-2xl font-bold">Ticket</h1>
        )}

        {isHowItWorks ? (
          <div className="min-h-0 flex-1 space-y-4" data-testid="support-thread">
            {threadMessages.map((message) => {
              const isUser = message.authorType === 'user';
              return (
                <div
                  key={message.id}
                  className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed',
                      isUser
                        ? 'border-primary/30 bg-primary/15 text-foreground'
                        : 'border-border bg-background text-foreground',
                      message.pending && 'opacity-70',
                    )}
                  >
                    {isAssistantMessage(message.authorType) ? (
                      <MarkdownRenderer
                        content={message.body}
                        className="[&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0 [&_ol:last-child]:!mb-0 [&_blockquote:last-child]:!mb-0 [&_>div:last-child]:!mb-0"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{message.body}</p>
                    )}
                    {message.pending ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sending...
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {awaitingAssistant ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <Spinner size="xs" />
                  Looking up help articles...
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <ol className="mb-6 space-y-3" data-testid="support-thread">
            {threadMessages.length === 0 ? (
              <li className="text-sm text-muted-foreground">No messages yet.</li>
            ) : (
              threadMessages.map((message) => (
                <li
                  key={message.id}
                  className={`rounded-lg border border-border p-4 ${
                    message.pending ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatMessageAuthor(message.authorType)}
                      {message.pending ? ' · Sending…' : ''}
                    </p>
                    {message.createdAt && !message.pending ? (
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={message.createdAt}
                      >
                        {formatSupportWhen(message.createdAt)}
                      </time>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-foreground">
                    {message.body}
                  </p>
                </li>
              ))
            )}
          </ol>
        )}

        {ticket && !isOpen ? (
          <p className="mt-6 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            This ticket is closed. You can read the history here, but new
            messages are not accepted.
          </p>
        ) : null}

        {isOpen ? (
          <form
            className={cn('space-y-3', isHowItWorks ? 'mt-6 border-t border-border pt-4' : '')}
            onSubmit={onSend}
          >
            <Textarea
              id="support-reply"
              label={isHowItWorks ? undefined : 'Reply'}
              value={body}
              onChange={(change) => setBody(change.target.value)}
              placeholder={
                isHowItWorks
                  ? 'Ask another question...'
                  : 'Write a message to support'
              }
              className="min-h-24"
              data-testid="support-reply"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={pending || !body.trim() || (isHowItWorks && awaitingAssistant)}
            >
              Send
            </Button>
          </form>
        ) : null}
      </div>
    </Page>
  );
};
