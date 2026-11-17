import {
  auth,
  ensureAppCheckToken,
  firebaseProjectId,
  useEmulator,
} from '../config/firebase';
import { AgentMessageInput, AgentMessageStreamEvent } from '@shared-types';
import { parseAgentMessageSseStream } from '@studyforge/client-data/agentSse';

export { parseAgentMessageSseStream };

export function resolveAgentMessageStreamUrl(): string {
  if (useEmulator) {
    return `http://127.0.0.1:5001/${firebaseProjectId}/asia-east1/agentMessageStream`;
  }
  return `https://asia-east1-${firebaseProjectId}.cloudfunctions.net/agentMessageStream`;
}

export async function streamAgentMessage(
  payload: AgentMessageInput,
  options: {
    onEvent: (event: AgentMessageStreamEvent) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use the agent.');
  }

  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    ensureAppCheckToken(),
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
