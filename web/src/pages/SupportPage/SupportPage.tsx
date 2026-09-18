import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  listenAskResult,
  listenMyTickets,
  submitSupportCommand,
  type SupportAskResult,
  type SupportCategory,
  type SupportTicket,
} from './supportFirestore';

export const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState<SupportCategory>('how_it_works');
  const [queryText, setQueryText] = useState('');
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const [askResult, setAskResult] = useState<SupportAskResult | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }
    return listenMyTickets(user.uid, setTickets);
  }, [user?.uid]);

  useEffect(() => {
    if (!askId) {
      return;
    }
    return listenAskResult(askId, setAskResult, setError);
  }, [askId]);

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
        setAskId(commandId);
        setAskResult(null);
      } else {
        await submitSupportCommand({
          type: 'CreateTicket',
          userId: user.uid,
          userEmail: user.email,
          payload: {
            category,
            query: text,
            ...(url.trim() ? { url: url.trim() } : {}),
          },
        });
        setAskId(null);
        setAskResult(null);
        setQueryText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setPending(false);
    }
  };

  const onStillNeedHelp = async () => {
    if (!user?.uid || !user.email || !queryText.trim()) {
      return;
    }
    setPending(true);
    try {
      await submitSupportCommand({
        type: 'CreateTicket',
        userId: user.uid,
        userEmail: user.email,
        payload: {
          category: 'how_it_works',
          query: queryText.trim(),
          askCommandId: askId,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
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
          <label className="block text-sm font-medium">
            Category
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              value={category}
              onChange={(change) =>
                setCategory(change.target.value as SupportCategory)
              }
              data-testid="support-category"
            >
              <option value="how_it_works">How it works</option>
              <option value="bug">Bug</option>
              <option value="billing">Billing</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Question or report
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
              value={queryText}
              onChange={(change) => setQueryText(change.target.value)}
              required
              data-testid="support-query"
            />
          </label>
          {category !== 'how_it_works' ? (
            <label className="block text-sm font-medium">
              Page URL (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                value={url}
                onChange={(change) => setUrl(change.target.value)}
                data-testid="support-url"
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending} data-testid="support-submit">
            {category === 'how_it_works' ? 'Ask' : 'Create ticket'}
          </Button>
        </form>

        {askId && !askResult ? (
          <p className="text-muted-foreground" data-testid="support-ask-pending">
            Looking up help articles...
          </p>
        ) : null}

        {askResult ? (
          <section
            className="space-y-3 rounded-lg border border-border p-4"
            data-testid="support-ask-result"
          >
            <h2 className="font-heading text-lg font-semibold">Answer</h2>
            {askResult.answer ? (
              <p>{askResult.answer}</p>
            ) : (
              <p>
                {askResult.noAnswerReason ||
                  'I do not have that in the help articles.'}
              </p>
            )}
            {askResult.citations.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Sources: {askResult.citations.join(', ')}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAskId(null);
                  setAskResult(null);
                }}
              >
                That helped
              </Button>
              <Button type="button" onClick={onStillNeedHelp} disabled={pending}>
                Still need help
              </Button>
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-heading text-lg font-semibold">My tickets</h2>
          {tickets.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="support-ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link className="underline" to={`/support/${ticket.id}`}>
                    {ticket.title} ({ticket.status})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
};
