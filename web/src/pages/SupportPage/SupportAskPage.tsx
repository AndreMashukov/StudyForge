import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { formatSupportCategory } from './supportFormat';
import {
  listenAskResult,
  submitCreateTicket,
  submitMarkAskResolved,
  type SupportAskResult,
} from './supportFirestore';

type AskLocationState = {
  query?: string;
};

export const SupportAskPage: React.FC = () => {
  const { commandId } = useParams<{ commandId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryFromState = (location.state as AskLocationState | null)?.query?.trim() ?? '';
  const [askResult, setAskResult] = useState<SupportAskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!commandId) {
      return;
    }
    return listenAskResult(commandId, setAskResult, setError);
  }, [commandId]);

  const title =
    askResult?.query?.trim() || queryFromState || 'Your question';

  const onThatHelped = async () => {
    if (!user?.uid || !user.email || !commandId) {
      navigate('/support');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await submitMarkAskResolved({
        userId: user.uid,
        userEmail: user.email,
        askCommandId: commandId,
      });
      navigate('/support');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your choice');
    } finally {
      setPending(false);
    }
  };

  const onStillNeedHelp = async () => {
    const query = askResult?.query?.trim() || queryFromState;
    if (!user?.uid || !user.email || !query || !commandId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const ticketId = await submitCreateTicket({
        userId: user.uid,
        userEmail: user.email,
        payload: {
          category: 'how_it_works',
          query,
          askCommandId: commandId,
        },
      });
      navigate(`/support/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
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

        <header className="space-y-2 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {formatSupportCategory('how_it_works')}
            </Badge>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {title}
          </h1>
        </header>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!askResult ? (
          <p className="text-muted-foreground" data-testid="support-ask-pending">
            Looking up help articles...
          </p>
        ) : (
          <section
            className="space-y-3 rounded-lg border border-border p-4"
            data-testid="support-ask-result"
          >
            <h2 className="font-heading text-lg font-semibold">Answer</h2>
            {askResult.answer ? (
              <p className="whitespace-pre-wrap">{askResult.answer}</p>
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onThatHelped}
                disabled={pending}
              >
                That helped
              </Button>
              <Button type="button" onClick={onStillNeedHelp} disabled={pending}>
                Still need help
              </Button>
            </div>
          </section>
        )}
      </div>
    </Page>
  );
};
