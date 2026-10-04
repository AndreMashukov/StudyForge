import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
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

export const SupportTicketPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const justCreated = Boolean(
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

  const threadMessages = useMemo(
    () => mergeThreadMessages(messages, pendingBody),
    [messages, pendingBody],
  );

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
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 pb-10">
        <p>
          <Link className="text-sm underline" to="/support">
            Back to Support
          </Link>
        </p>

        {justCreated ? (
          <p
            className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
            data-testid="support-ticket-submitted"
          >
            Ticket submitted. We usually reply within a few hours.
          </p>
        ) : null}

        {ticket ? (
          <header className="space-y-2 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {ticket.status}
              </Badge>
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
          <h1 className="font-heading text-2xl font-bold">Ticket</h1>
        )}

        <ol className="space-y-3" data-testid="support-thread">
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

        {ticket && !isOpen ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            This ticket is closed. You can read the history here, but new
            messages are not accepted.
          </p>
        ) : null}

        {isOpen ? (
          <form className="space-y-3" onSubmit={onSend}>
            <Textarea
              id="support-reply"
              label="Reply"
              value={body}
              onChange={(change) => setBody(change.target.value)}
              placeholder="Write a message to support"
              className="min-h-24"
              data-testid="support-reply"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || !body.trim()}>
              Send
            </Button>
          </form>
        ) : null}
      </div>
    </Page>
  );
};
