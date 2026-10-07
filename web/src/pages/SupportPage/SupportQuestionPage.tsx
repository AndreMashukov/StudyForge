import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SupportHub } from './SupportHub';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { formatSupportCategory } from './supportFormat';
import {
  listenAskMessages,
  listenAskResult,
  submitFollowUpAsk,
  submitMarkAskResolved,
  type SupportAskResult,
  type SupportThreadMessage,
} from './supportFirestore';

function isAssistantMessage(authorType: string): boolean {
  return authorType === 'system' || authorType === 'staff';
}

function mergePendingUserMessage(
  messages: SupportThreadMessage[],
  pendingBody: string | null,
): SupportThreadMessage[] {
  if (!pendingBody?.trim()) {
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

function legacyMessagesFromAsk(ask: SupportAskResult): SupportThreadMessage[] {
  const query = ask.query.trim();
  const items: SupportThreadMessage[] = [];
  if (query) {
    items.push({
      id: '__legacy_user__',
      authorType: 'user',
      body: query,
      createdAt: ask.createdAt,
    });
  }
  const assistantBody = ask.answer
    ? ask.answer +
      (ask.citations.length > 0
        ? `\n\nSources: ${ask.citations.join(', ')}`
        : '')
    : ask.noAnswerReason || 'I do not have that in the help articles.';
  if (ask.status === 'completed' || ask.answer || ask.noAnswerReason) {
    items.push({
      id: '__legacy_system__',
      authorType: 'system',
      body: assistantBody,
      createdAt: ask.resolvedAt ?? ask.createdAt,
    });
  }
  return items;
}

export const SupportQuestionPage: React.FC = () => {
  const { commandId } = useParams<{ commandId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [askResult, setAskResult] = useState<SupportAskResult | null>(null);
  const [messages, setMessages] = useState<SupportThreadMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);

  useEffect(() => {
    if (!commandId) {
      return;
    }
    return listenAskResult(commandId, setAskResult, setError);
  }, [commandId]);

  const askReady = askResult != null;
  useEffect(() => {
    if (!commandId || !askReady) {
      return;
    }
    return listenAskMessages(commandId, setMessages);
  }, [commandId, askReady]);

  useEffect(() => {
    if (!pendingFollowUp) {
      return;
    }
    const hasPendingUser = messages.some(
      (message) =>
        message.authorType === 'user' &&
        message.body.trim() === pendingFollowUp.trim() &&
        !message.pending,
    );
    if (!hasPendingUser) {
      return;
    }
    const last = messages[messages.length - 1];
    if (last && isAssistantMessage(last.authorType)) {
      setPendingFollowUp(null);
    }
  }, [messages, pendingFollowUp]);

  const displayMessages = useMemo(() => {
    if (messages.length > 0) {
      return mergePendingUserMessage(messages, pendingFollowUp);
    }
    if (askResult) {
      return mergePendingUserMessage(
        legacyMessagesFromAsk(askResult),
        pendingFollowUp,
      );
    }
    return mergePendingUserMessage([], pendingFollowUp);
  }, [messages, askResult, pendingFollowUp]);

  const isResolved = askResult?.resolution === 'confirmed_helped';
  const isEscalated =
    askResult?.resolution === 'escalated' || Boolean(askResult?.ticketId);
  const threadOpen = Boolean(askResult) && !isResolved && !isEscalated;
  const followUpWaitingOnServer =
    Boolean(pendingFollowUp) &&
    !messages.some(
      (message, index) =>
        !message.pending &&
        message.authorType === 'user' &&
        message.body.trim() === pendingFollowUp?.trim() &&
        messages.slice(index + 1).some((later) => isAssistantMessage(later.authorType)),
    );
  const awaitingAssistant =
    followUpWaitingOnServer ||
    (!askResult && Boolean(commandId)) ||
    (askResult !== null &&
      messages.length === 0 &&
      !askResult.answer &&
      !askResult.noAnswerReason &&
      askResult.status !== 'completed');

  const title = askResult?.query?.trim() || 'Your question';

  const onThatHelped = async () => {
    if (!user?.uid || !user.email || !commandId) {
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

  const onFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = followUpText.trim();
    if (!user?.uid || !user.email || !commandId || !text || !threadOpen) {
      return;
    }
    setPending(true);
    setError(null);
    setPendingFollowUp(text);
    setFollowUpText('');
    try {
      await submitFollowUpAsk({
        userId: user.uid,
        userEmail: user.email,
        askCommandId: commandId,
        query: text,
      });
    } catch (err) {
      setPendingFollowUp(null);
      setError(err instanceof Error ? err.message : 'Could not send follow-up');
    } finally {
      setPending(false);
    }
  };

  return (
    <SupportHub selectedAskId={commandId}>
      <div className="flex flex-col border-t border-border pt-6">
        <header className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {formatSupportCategory('how_it_works')}
            </Badge>
            {isResolved ? (
              <Badge variant="secondary">That helped</Badge>
            ) : null}
            {isEscalated ? (
              <Badge variant="secondary">Escalated</Badge>
            ) : null}
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {title}
          </h1>
        </header>

        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        <div className="min-h-0 flex-1 space-y-4" data-testid="support-question-thread">
          {displayMessages.map((message) => {
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
                      className="[&_p:last-child]:!mb-0 [&_ul:last-child]:!mb-0 [&_ol:last-child]:!mb-0"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  )}
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

        {isResolved ? (
          <p className="mt-6 text-sm text-muted-foreground">
            You marked this as helpful.
          </p>
        ) : null}
        {isEscalated && askResult?.ticketId ? (
          <p className="mt-6 text-sm text-muted-foreground">
            This question was escalated.{' '}
            <Link className="underline" to={`/support/${askResult.ticketId}`}>
              Open your ticket
            </Link>
            .
          </p>
        ) : null}

        {threadOpen && !awaitingAssistant ? (
          <div className="mt-6 space-y-4 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onThatHelped}
                disabled={pending}
              >
                That helped
              </Button>
            </div>
            <form className="space-y-2" onSubmit={onFollowUp}>
              <Textarea
                label="Follow-up question"
                value={followUpText}
                onChange={(change) => setFollowUpText(change.target.value)}
                className="min-h-20"
                data-testid="support-question-follow-up"
              />
              <Button type="submit" disabled={pending || !followUpText.trim()}>
                Send
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </SupportHub>
  );
};
