import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { Page } from '../../components/Page';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/ui/Badge/Badge';
import {
  formatSupportCategory,
  formatSupportWhen,
  ticketSortTimestamp,
} from './supportFormat';
import {
  listenAskResult,
  listenMyAskHistory,
  listenMyTickets,
  submitCreateTicket,
  submitMarkAskResolved,
  submitSupportCommand,
  type SupportAskHistoryItem,
  type SupportAskResult,
  type SupportCategory,
  type SupportTicket,
} from './supportFirestore';

export const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const helpId = searchParams.get('help');
  const { user } = useAuth();
  const [askResult, setAskResult] = useState<SupportAskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [askPending, setAskPending] = useState(false);
  const [category, setCategory] = useState<SupportCategory>('how_it_works');
  const [queryText, setQueryText] = useState('');
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [askHistory, setAskHistory] = useState<SupportAskHistoryItem[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }
    return listenMyTickets(user.uid, setTickets);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }
    return listenMyAskHistory(user.uid, setAskHistory);
  }, [user?.uid]);

  useEffect(() => {
    if (!helpId) {
      setAskResult(null);
      return;
    }
    return listenAskResult(helpId, setAskResult, setAskError);
  }, [helpId]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.uid || !user.email) {
      return;
    }
    const text = queryText.trim();
    if (!text) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (category === 'how_it_works') {
        const commandId = await submitSupportCommand({
          type: 'AskHowItWorks',
          userId: user.uid,
          userEmail: user.email,
          payload: { query: text },
        });
        setSearchParams({ help: commandId });
        setQueryText('');
        return;
      }
      const ticketId = await submitCreateTicket({
        userId: user.uid,
        userEmail: user.email,
        payload: {
          category,
          query: text,
          ...(url.trim() ? { url: url.trim() } : {}),
        },
      });
      navigate(`/support/${ticketId}`, { state: { justCreated: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setPending(false);
    }
  };

  return (
    <Page showSidebar={true}>
      <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Support</h1>
          <p className="mt-1 text-muted-foreground">
            Ask how StudyForge works, or file a bug or billing ticket. Anonymous
            tickets are not allowed.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="support-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as SupportCategory)}
            >
              <SelectTrigger
                id="support-category"
                aria-label="Category"
                data-testid="support-category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="how_it_works">How it works</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            id="support-query"
            label="Question or report"
            value={queryText}
            onChange={(change) => setQueryText(change.target.value)}
            required
            className="min-h-28"
            data-testid="support-query"
          />
          {category !== 'how_it_works' ? (
            <div className="space-y-2">
              <Label htmlFor="support-url">Page URL (optional)</Label>
              <Input
                id="support-url"
                value={url}
                onChange={(change) => setUrl(change.target.value)}
                data-testid="support-url"
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending} data-testid="support-submit">
            {category === 'how_it_works' ? 'Ask' : 'Create ticket'}
          </Button>
        </form>

        {helpId ? (
          <AskResultPanel
            commandId={helpId}
            askResult={askResult}
            error={askError}
            pending={askPending}
            userId={user?.uid}
            userEmail={user?.email}
            onPending={setAskPending}
            onResolved={() => {
              setAskResult((prev) =>
                prev
                  ? {
                      ...prev,
                      resolution: 'confirmed_helped',
                      resolvedAt: new Date().toISOString(),
                    }
                  : prev,
              );
              setSearchParams({});
            }}
          />
        ) : null}

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Recent help</h2>
          <p className="text-sm text-muted-foreground">
            Past how-it-works answers. Escalated questions appear under My tickets.
          </p>
          {askHistory.length === 0 ? (
            <p className="text-muted-foreground">No help questions yet.</p>
          ) : (
            <ul className="space-y-3" data-testid="support-ask-history">
              {askHistory.map((item) => (
                <li key={item.id}>
                  <Link
                    className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                    to={`/support?help=${item.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">How it works</Badge>
                      {item.resolution === 'confirmed_helped' ? (
                        <Badge variant="secondary">That helped</Badge>
                      ) : null}
                      {item.createdAt ? (
                        <span className="text-xs text-muted-foreground">
                          {formatSupportWhen(item.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium text-foreground">{item.query}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">My tickets</h2>
          <p className="text-sm text-muted-foreground">
            Sorted by latest activity. Open a ticket to see the full thread.
          </p>
          {tickets.length === 0 ? (
            <p className="text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="space-y-3" data-testid="support-ticket-list">
              {tickets.map((ticket) => {
                const activityAt = ticketSortTimestamp(
                  ticket.updatedAt,
                  ticket.createdAt,
                );
                const preview =
                  ticket.lastMessagePreview?.trim() ||
                  ticket.title?.trim() ||
                  'No messages yet';
                const isOpen = ticket.status === 'open';
                return (
                  <li key={ticket.id}>
                    <Link
                      className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                      to={`/support/${ticket.id}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isOpen ? 'default' : 'secondary'}>
                          {ticket.status}
                        </Badge>
                        <Badge variant="outline">
                          {formatSupportCategory(ticket.category)}
                        </Badge>
                        {activityAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatSupportWhen(activityAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-medium text-foreground">
                        {ticket.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {preview}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
};

function AskResultPanel(props: {
  commandId: string;
  askResult: SupportAskResult | null;
  error: string | null;
  pending: boolean;
  userId: string | undefined;
  userEmail: string | null | undefined;
  onPending: (pending: boolean) => void;
  onResolved: () => void;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const isResolved = props.askResult?.resolution === 'confirmed_helped';
  const isEscalated =
    props.askResult?.resolution === 'escalated' || Boolean(props.askResult?.ticketId);
  const showActions = props.askResult && !isResolved && !isEscalated;

  const onThatHelped = async () => {
    if (!props.userId || !props.userEmail) {
      return;
    }
    props.onPending(true);
    setError(null);
    try {
      await submitMarkAskResolved({
        userId: props.userId,
        userEmail: props.userEmail,
        askCommandId: props.commandId,
      });
      props.onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice');
    } finally {
      props.onPending(false);
    }
  };

  const onStillNeedHelp = async () => {
    const query = props.askResult?.query?.trim();
    if (!props.userId || !props.userEmail || !query) {
      return;
    }
    props.onPending(true);
    setError(null);
    try {
      const ticketId = await submitCreateTicket({
        userId: props.userId,
        userEmail: props.userEmail,
        payload: {
          category: 'how_it_works',
          query,
          askCommandId: props.commandId,
        },
      });
      navigate(`/support/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
    } finally {
      props.onPending(false);
    }
  };

  const shownError = error || props.error;

  return (
    <section
      className="space-y-3 rounded-lg border border-border p-4"
      data-testid="support-ask-result"
    >
      <h2 className="font-heading text-lg font-semibold">
        {props.askResult?.query?.trim() || 'Your question'}
      </h2>
      {shownError ? <p className="text-sm text-destructive">{shownError}</p> : null}
      {!props.askResult ? (
        <p className="text-muted-foreground" data-testid="support-ask-pending">
          Looking up help articles...
        </p>
      ) : (
        <>
          {props.askResult.answer ? (
            <MarkdownRenderer
              content={props.askResult.answer}
              className="text-sm leading-relaxed [&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0"
            />
          ) : (
            <p>
              {props.askResult.noAnswerReason ||
                'I do not have that in the help articles.'}
            </p>
          )}
          {props.askResult.citations.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Sources: {props.askResult.citations.join(', ')}
            </p>
          ) : null}
          {isResolved ? (
            <p className="text-sm text-muted-foreground">
              You marked this answer as helpful.
            </p>
          ) : null}
          {isEscalated && props.askResult.ticketId ? (
            <p className="text-sm text-muted-foreground">
              This question was escalated.{' '}
              <Link className="underline" to={`/support/${props.askResult.ticketId}`}>
                Open your ticket
              </Link>
              .
            </p>
          ) : null}
          {showActions ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onThatHelped}
                disabled={props.pending}
              >
                That helped
              </Button>
              <Button
                type="button"
                onClick={onStillNeedHelp}
                disabled={props.pending}
              >
                Still need help
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
