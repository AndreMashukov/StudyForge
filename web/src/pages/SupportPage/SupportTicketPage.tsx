import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import {
  listenTicketMessages,
  submitSupportCommand,
  type SupportMessage,
} from './supportFirestore';

export const SupportTicketPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      return;
    }
    return listenTicketMessages(ticketId, setMessages);
  }, [ticketId]);

  const onSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.uid || !user.email || !ticketId || !body.trim()) {
      return;
    }
    setPending(true);
    try {
      await submitSupportCommand({
        type: 'AppendMessage',
        userId: user.uid,
        userEmail: user.email,
        payload: { ticketId, body: body.trim() },
      });
      setBody('');
    } finally {
      setPending(false);
    }
  };

  return (
    <Page showSidebar={true}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        <p>
          <Link className="underline" to="/support">
            Back to Support
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-bold">Ticket</h1>
        <ol className="space-y-3" data-testid="support-thread">
          {messages.map((message) => (
            <li
              key={message.id}
              className="rounded-md border border-border p-3"
            >
              <p className="text-xs uppercase text-muted-foreground">
                {message.authorType}
              </p>
              <p className="mt-1">{message.body}</p>
            </li>
          ))}
        </ol>
        <form className="space-y-3" onSubmit={onSend}>
          <textarea
            className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
            value={body}
            onChange={(change) => setBody(change.target.value)}
            data-testid="support-reply"
          />
          <Button type="submit" disabled={pending}>
            Send
          </Button>
        </form>
      </div>
    </Page>
  );
};
