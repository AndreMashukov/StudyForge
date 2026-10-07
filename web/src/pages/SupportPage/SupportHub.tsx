import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { cn } from '../../lib/utils';
import {
  formatSupportCategory,
  formatSupportWhen,
  ticketSortTimestamp,
} from './supportFormat';
import {
  listenMyAskHistory,
  listenMyTickets,
  submitCreateTicket,
  submitSupportCommand,
  type SupportAskHistoryItem,
  type SupportCategory,
  type SupportTicket,
} from './supportFirestore';

type SupportHubProps = {
  children?: React.ReactNode;
  selectedAskId?: string | null;
  selectedTicketId?: string | null;
};

export const SupportHub: React.FC<SupportHubProps> = ({
  children,
  selectedAskId = null,
  selectedTicketId = null,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        setQueryText('');
        navigate(`/support/question/${commandId}`);
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
      setQueryText('');
      setUrl('');
      navigate(`/support/${ticketId}`, { state: { justCreated: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setPending(false);
    }
  };

  return (
    <Page showSidebar={true}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Support
            </h1>
            <p className="mt-1 text-muted-foreground">
              Ask how StudyForge works, or file a bug or billing ticket.
              Anonymous tickets are not allowed.
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

          {children}
        </div>

        <aside className="min-w-0 space-y-8">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Recent help</h2>
            <p className="text-sm text-muted-foreground">
              Past how-it-works answers from help articles.
            </p>
            {askHistory.length === 0 ? (
              <p className="text-muted-foreground">No help questions yet.</p>
            ) : (
              <ul className="space-y-3" data-testid="support-ask-history">
                {askHistory.map((item) => {
                  const selected = item.id === selectedAskId;
                  return (
                    <li key={item.id}>
                      <Link
                        className={cn(
                          'block rounded-lg border p-4 transition-colors hover:bg-muted/40',
                          selected
                            ? 'border-primary bg-muted/40'
                            : 'border-border',
                        )}
                        to={`/support/question/${item.id}`}
                        aria-current={selected ? 'page' : undefined}
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
                        <p className="mt-2 font-medium text-foreground">
                          {item.query}
                        </p>
                      </Link>
                    </li>
                  );
                })}
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
                  const selected = ticket.id === selectedTicketId;
                  return (
                    <li key={ticket.id}>
                      <Link
                        className={cn(
                          'block rounded-lg border p-4 transition-colors hover:bg-muted/40',
                          selected
                            ? 'border-primary bg-muted/40'
                            : 'border-border',
                        )}
                        to={`/support/${ticket.id}`}
                        aria-current={selected ? 'page' : undefined}
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
        </aside>
      </div>
    </Page>
  );
};
