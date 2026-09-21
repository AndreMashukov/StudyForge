import { GoogleAuth } from 'google-auth-library';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';

const SUPPORT_EVENTS_TOPIC = 'support-events';

type JsonMap = Record<string, unknown>;

function asObject(value: unknown): JsonMap {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonMap)
    : {};
}

function commandSubmittedPayload(commandId: string, data: JsonMap): JsonMap {
  return {
    v: 1,
    event_type: 'command.submitted',
    write_id: String(data.write_id ?? ''),
    command_id: commandId,
    type: String(data.type ?? ''),
    user_id: String(data.userId ?? ''),
    user_email: String(data.userEmail ?? ''),
    payload: asObject(data.payload),
  };
}

async function publishSupportEvent(payload: JsonMap): Promise<void> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    logger.info('support-cdc skip Pub/Sub in emulator', payload.event_type);
    return;
  }
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error('GCP project is missing');
  }
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/pubsub'],
  });
  const client = await auth.getClient();
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  await client.request({
    url: `https://pubsub.googleapis.com/v1/projects/${project}/topics/${SUPPORT_EVENTS_TOPIC}:publish`,
    method: 'POST',
    data: {
      messages: [
        {
          data,
          attributes: {
            event_type: String(payload.event_type ?? ''),
          },
        },
      ],
    },
  });
}

export const supportCommandCdc = onDocumentWritten(
  {
    document: 'supportCommands/{commandId}',
    region: 'asia-east1',
  },
  async (event) => {
    const data = event.data?.after?.data();
    const commandId = event.params.commandId;
    if (!data || !commandId) {
      return;
    }
    if (event.data?.before?.exists) {
      return;
    }
    const payload = commandSubmittedPayload(commandId, data);
    await publishSupportEvent(payload);
    logger.info('support-cdc published command.submitted', commandId);
  },
);

function leanWriteIdChanged(
  existing: FirebaseFirestore.DocumentData | undefined,
  writeId: string,
): boolean {
  if (!existing) {
    return true;
  }
  return String(existing.write_id ?? '') !== writeId;
}

async function projectAskCompleted(payload: JsonMap): Promise<void> {
  const commandId = String(payload.command_id ?? '');
  const writeId = String(payload.write_id ?? '');
  if (!commandId) {
    return;
  }
  const ref = getFirestore().collection('supportAskResults').doc(commandId);
  const snap = await ref.get();
  if (!leanWriteIdChanged(snap.data(), writeId)) {
    return;
  }
  await ref.set({
    userId: payload.user_id ?? '',
    query: payload.query ?? '',
    enoughContext: Boolean(payload.enough_context),
    answer: payload.answer ?? null,
    citations: Array.isArray(payload.citations) ? payload.citations : [],
    noAnswerReason: payload.no_answer_reason ?? null,
    status: payload.status ?? 'completed',
    write_id: writeId,
  });
}

async function projectTicketUpdated(payload: JsonMap): Promise<void> {
  const ticketId = String(payload.ticket_id ?? '');
  const writeId = String(payload.write_id ?? '');
  if (!ticketId) {
    return;
  }
  const ref = getFirestore().collection('supportTickets').doc(ticketId);
  const snap = await ref.get();
  if (leanWriteIdChanged(snap.data(), writeId)) {
    await ref.set({
      userId: payload.user_id ?? '',
      userEmail: payload.user_email ?? '',
      category: payload.category ?? '',
      status: payload.status ?? 'open',
      title: payload.title ?? '',
      url: payload.url ?? null,
      createdAt: payload.created_at ?? null,
      closedAt: payload.closed_at ?? null,
      closedBy: payload.closed_by ?? null,
      write_id: writeId,
    });
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (const raw of messages) {
    const message = asObject(raw);
    const messageId = String(message.id ?? '');
    if (!messageId) {
      continue;
    }
    await ref.collection('messages').doc(messageId).set({
      authorType: message.author_type ?? '',
      authorId: message.author_id ?? null,
      body: message.body ?? '',
      createdAt: message.created_at ?? null,
      write_id: message.write_id ?? writeId,
    });
  }
}

export const supportLeanProject = onMessagePublished(
  {
    topic: SUPPORT_EVENTS_TOPIC,
    region: 'asia-east1',
  },
  async (event) => {
    const payload = (event.data.message.json ?? {}) as JsonMap;
    const eventType = String(payload.event_type ?? '');
    if (eventType === 'ask.completed') {
      await projectAskCompleted(payload);
    }
  },
);

export const supportTicketLeanProject = onMessagePublished(
  {
    topic: SUPPORT_EVENTS_TOPIC,
    region: 'asia-east1',
  },
  async (event) => {
    const payload = (event.data.message.json ?? {}) as JsonMap;
    const eventType = String(payload.event_type ?? '');
    if (eventType === 'ticket.created' || eventType === 'ticket.updated') {
      await projectTicketUpdated(payload);
    }
  },
);
