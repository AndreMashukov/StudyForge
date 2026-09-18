import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export type SupportCategory = 'how_it_works' | 'bug' | 'billing';

export interface SupportAskResult {
  enoughContext: boolean;
  answer: string | null;
  citations: string[];
  noAnswerReason: string | null;
  query: string;
  status: string;
}

export interface SupportTicket {
  id: string;
  title: string;
  category: string;
  status: string;
}

export interface SupportMessage {
  id: string;
  authorType: string;
  body: string;
}

function writeId(): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function submitSupportCommand(input: {
  type: 'AskHowItWorks' | 'CreateTicket' | 'AppendMessage';
  userId: string;
  userEmail: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const commandId = crypto.randomUUID();
  await setDoc(doc(db, 'supportCommands', commandId), {
    type: input.type,
    userId: input.userId,
    userEmail: input.userEmail,
    write_id: writeId(),
    payload: input.payload,
    createdAt: new Date().toISOString(),
  });
  return commandId;
}

export function listenAskResult(
  commandId: string,
  onNext: (result: SupportAskResult | null) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'supportAskResults', commandId),
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      const data = snap.data();
      onNext({
        enoughContext: Boolean(data.enoughContext),
        answer: (data.answer as string | null) ?? null,
        citations: Array.isArray(data.citations) ? (data.citations as string[]) : [],
        noAnswerReason: (data.noAnswerReason as string | null) ?? null,
        query: String(data.query ?? ''),
        status: String(data.status ?? ''),
      });
    },
    (err) => {
      onError?.(err.message);
    },
  );
}

export function listenMyTickets(
  userId: string,
  onNext: (tickets: SupportTicket[]) => void,
): Unsubscribe {
  const ticketsQuery = query(
    collection(db, 'supportTickets'),
    where('userId', '==', userId),
    limit(50),
  );
  return onSnapshot(ticketsQuery, (snap) => {
    onNext(
      snap.docs.map((item) => ({
        id: item.id,
        title: String(item.data().title ?? 'Ticket'),
        category: String(item.data().category ?? ''),
        status: String(item.data().status ?? 'open'),
      })),
    );
  });
}

export function listenTicketMessages(
  ticketId: string,
  onNext: (messages: SupportMessage[]) => void,
): Unsubscribe {
  const messagesQuery = query(
    collection(db, 'supportTickets', ticketId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100),
  );
  return onSnapshot(messagesQuery, (snap) => {
    onNext(
      snap.docs.map((item) => ({
        id: item.id,
        authorType: String(item.data().authorType ?? 'user'),
        body: String(item.data().body ?? ''),
      })),
    );
  });
}
