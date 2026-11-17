import { fetch } from 'expo/fetch';
import type {
  AgentMessageRequest,
  AgentMessageStreamEvent,
} from '@shared-types';
import { parseAgentMessageSseStream } from '@studyforge/client-data/agentSse';
import { auth, getAppCheckTokenForRequest } from '../firebase';
import {
  FIREBASE_FUNCTIONS_REGION,
  getEmulatorHost,
  getFirebasePublicConfig,
  useFirebaseEmulator,
} from '../firebase/config';

/** Thrown when the user is out of credits or over a plan limit (HTTP 429). */
export class AgentLimitError extends Error {}

export function resolveAgentMessageStreamUrl(): string {
  const { projectId } = getFirebasePublicConfig();
  if (useFirebaseEmulator()) {
    return `http://${getEmulatorHost()}:5001/${projectId}/${FIREBASE_FUNCTIONS_REGION}/agentMessageStream`;
  }
  return `https://${FIREBASE_FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/agentMessageStream`;
}

async function readErrorMessage(
  response: { json: () => Promise<unknown> },
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    // Non-JSON error body.
  }
  return fallback;
}

/** POST one agent turn and stream its SSE events (expo/fetch supports streaming bodies). */
export async function streamAgentMessage(
  payload: AgentMessageRequest,
  options: {
    onEvent: (event: AgentMessageStreamEvent) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in to use the assistant.');
  }
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getAppCheckTokenForRequest(),
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
    body: JSON.stringify({
      ...payload,
      clientLocalDate: payload.clientLocalDate ?? localIsoDate(),
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Assistant request failed (${response.status})`,
    );
    if (response.status === 429) {
      throw new AgentLimitError(message);
    }
    throw new Error(message);
  }
  if (!response.body) {
    throw new Error('Assistant stream body missing');
  }

  for await (const event of parseAgentMessageSseStream(response.body)) {
    options.onEvent(event);
    if (event.type === 'error' || event.type === 'done') {
      break;
    }
  }
}

function localIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
