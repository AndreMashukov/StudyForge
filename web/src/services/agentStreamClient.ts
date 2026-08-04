import {
  auth,
  appCheckInstance,
  firebaseProjectId,
  useEmulator,
  waitForAppCheckReady,
} from '../config/firebase';
import { getToken } from 'firebase/app-check';
import {
  AgentMessageInput,
  AgentMessageStreamEvent,
  agentMessageStreamEventSchema,
} from '@shared-types';

export function resolveAgentMessageStreamUrl(): string {
  if (useEmulator) {
    return `http://127.0.0.1:5001/${firebaseProjectId}/asia-east1/agentMessageStream`;
  }
  return `https://asia-east1-${firebaseProjectId}.cloudfunctions.net/agentMessageStream`;
}

function parseSseBlock(block: string): AgentMessageStreamEvent | null {
  const lines = block.split('\n');
  let eventType: string | undefined;
  let dataLine: string | undefined;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLine = line.slice(5).trim();
    }
  }

  if (!dataLine) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(dataLine);
    const validated = agentMessageStreamEventSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    if (eventType === 'error' && typeof parsed === 'object' && parsed !== null) {
      const message =
        'message' in parsed && typeof parsed.message === 'string'
          ? parsed.message
          : 'Agent stream error';
      return { type: 'error', message };
    }
  } catch {
    return null;
  }

  return null;
}

export async function* parseAgentMessageSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AgentMessageStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = parseSseBlock(block.trim());
        if (event) {
          yield event;
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseBlock(buffer.trim());
      if (event) {
        yield event;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed.
    }
    reader.releaseLock();
  }
}

export async function streamAgentMessage(
  payload: AgentMessageInput,
  options: {
    onEvent: (event: AgentMessageStreamEvent) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  await waitForAppCheckReady();

  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use the agent.');
  }

  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    appCheckInstance
      ? getToken(appCheckInstance, false).then((result) => result.token).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  const response = await fetch(resolveAgentMessageStreamUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    let message = `Agent request failed (${response.status})`;
    try {
      const errorBody: unknown = await response.json();
      if (
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'error' in errorBody &&
        typeof errorBody.error === 'string'
      ) {
        message = errorBody.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Agent stream body missing');
  }

  for await (const event of parseAgentMessageSseStream(response.body)) {
    options.onEvent(event);
    if (event.type === 'error' || event.type === 'done') {
      break;
    }
  }
}
