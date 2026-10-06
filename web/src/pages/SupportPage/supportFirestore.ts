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
import { ticketSortTimestamp } from './supportFormat';

export type SupportCategory = 'how_it_works' | 'bug' | 'billing';

export type AskResolution = 'confirmed_helped' | 'escalated';

export interface SupportAskResult {
  enoughContext: boolean;
  answer: string | null;
  citations: string[];
  noAnswerReason: string | null;
  query: string;
  status: string;
  resolution: AskResolution | null;
  resolvedAt: string | null;
  ticketId: string | null;
  createdAt: string | null;
}

export interface SupportAskHistoryItem {
  id: string;
  query: string;
  resolution: AskResolution | null;
  ticketId: string | null;
  createdAt: string | null;
  enoughContext: boolean;
}

export interface SupportTicket {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastMessagePreview: string | null;
}

export interface SupportMessage {
  id: string;
  authorType: string;
  body: string;
  createdAt: string | null;
}

export type SupportThreadMessage = SupportMessage & {
  pending?: boolean;
};

function writeId(): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

const TICKET_TITLE_MAX = 300;
const TICKET_PREVIEW_MAX = 120;

function ticketTitleFromQuery(query: string): string {
  const trimmed = query.trim();
  return trimmed.slice(0, TICKET_TITLE_MAX) || 'Support ticket';
}

function ticketPreviewFromQuery(query: string): string | null {
  const trimmed = query.trim();
  return trimmed ? trimmed.slice(0, TICKET_PREVIEW_MAX) : null;
}

export async function submitCreateTicket(input: {
  userId: string;
  userEmail: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const commandId = crypto.randomUUID();
  const write_id = writeId();
  const now = new Date().toISOString();
  const queryText = String(input.payload.query ?? '').trim();
  const category = String(input.payload.category ?? 'bug');
  const urlRaw = input.payload.url;
  const url =
    urlRaw != null && String(urlRaw).trim() ? String(urlRaw).trim() : null;

  await setDoc(doc(db, 'supportCommands', commandId), {
    type: 'CreateTicket',
    userId: input.userId,
    userEmail: input.userEmail,
    write_id,
    payload: input.payload,
    createdAt: now,
  });

  await setDoc(doc(db, 'supportTickets', commandId), {
    userId: input.userId,
    userEmail: input.userEmail,
    category,
    status: 'open',
    title: ticketTitleFromQuery(queryText),
    ...(url ? { url } : {}),
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: ticketPreviewFromQuery(queryText),
    write_id,
  });

  return commandId;
}

export async function submitMarkAskResolved(input: {
  userId: string;
  userEmail: string;
  askCommandId: string;
}): Promise<void> {
  const commandId = crypto.randomUUID();
  await setDoc(doc(db, 'supportCommands', commandId), {
    type: 'MarkAskResolved',
    userId: input.userId,
    userEmail: input.userEmail,
    write_id: writeId(),
    payload: { askCommandId: input.askCommandId },
    createdAt: new Date().toISOString(),
  });
}

export async function submitSupportCommand(input: {
  type: 'AskHowItWorks' | 'CreateTicket' | 'AppendMessage' | 'MarkAskResolved';
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
        resolution: (data.resolution as AskResolution | null) ?? null,
        resolvedAt: (data.resolvedAt as string | null) ?? null,
        ticketId: (data.ticketId as string | null) ?? null,
        createdAt: (data.createdAt as string | null) ?? null,
      });
    },
    (err) => {
      onError?.(err.message);
    },
  );
}

function mapSupportTicketDoc(
  id: string,
  data: Record<string, unknown>,
): SupportTicket {
  return {
    id,
    title: String(data.title ?? 'Ticket'),
    category: String(data.category ?? ''),
    status: String(data.status ?? 'open'),
    createdAt: (data.createdAt as string | null) ?? null,
    updatedAt: (data.updatedAt as string | null) ?? null,
    lastMessagePreview: (data.lastMessagePreview as string | null) ?? null,
  };
}

function sortTicketsByActivity(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((left, right) =>
    ticketSortTimestamp(right.updatedAt, right.createdAt).localeCompare(
      ticketSortTimestamp(left.updatedAt, left.createdAt),
    ),
  );
}

function mapSupportAskHistoryItem(
  id: string,
  data: Record<string, unknown>,
): SupportAskHistoryItem {
  return {
    id,
    query: String(data.query ?? 'Question'),
    resolution: (data.resolution as AskResolution | null) ?? null,
    ticketId: (data.ticketId as string | null) ?? null,
    createdAt: (data.createdAt as string | null) ?? null,
    enoughContext: Boolean(data.enoughContext),
  };
}

function sortAskHistory(items: SupportAskHistoryItem[]): SupportAskHistoryItem[] {
  return [...items].sort((left, right) =>
    String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
  );
}

export function listenMyAskHistory(
  userId: string,
  onNext: (items: SupportAskHistoryItem[]) => void,
): Unsubscribe {
  const asksQuery = query(
    collection(db, 'supportAskResults'),
    where('userId', '==', userId),
    limit(50),
  );
  return onSnapshot(
    asksQuery,
    (snap) => {
      const items = snap.docs
        .map((item) =>
          mapSupportAskHistoryItem(item.id, item.data() as Record<string, unknown>),
        )
        .filter(
          (item) =>
            item.resolution !== 'escalated' && item.ticketId == null,
        );
      onNext(sortAskHistory(items));
    },
    (err) => {
      console.error('supportAskResults listener failed', err);
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
    const tickets = snap.docs.map((item) =>
      mapSupportTicketDoc(item.id, item.data() as Record<string, unknown>),
    );
    onNext(sortTicketsByActivity(tickets));
  });
}

export function listenSupportTicket(
  ticketId: string,
  onNext: (ticket: SupportTicket | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'supportTickets', ticketId), (snap) => {
    if (!snap.exists()) {
      onNext(null);
      return;
    }
    const data = snap.data();
    onNext({
      id: snap.id,
      title: String(data.title ?? 'Ticket'),
      category: String(data.category ?? ''),
      status: String(data.status ?? 'open'),
      createdAt: (data.createdAt as string | null) ?? null,
      updatedAt: (data.updatedAt as string | null) ?? null,
      lastMessagePreview: (data.lastMessagePreview as string | null) ?? null,
    });
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
        createdAt: (item.data().createdAt as string | null) ?? null,
      })),
    );
  });
}
