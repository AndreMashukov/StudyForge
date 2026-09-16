const SEED_EMAIL = 'test@example.com';
const SEED_PASSWORD = 'Test123456!';
const REGION = 'asia-east1';
const STREAM_TIMEOUT_MS = 290_000;

export function isKvRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveFirebaseProjectId(): string {
  return (
    process.env.NX_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    'study-forge-202604'
  );
}

export function resolveLiveEvalTarget(): 'emulator' | 'production' {
  const explicit = process.env.LIVE_EVAL_TARGET?.trim().toLowerCase();
  if (explicit === 'production') {
    return 'production';
  }
  return 'emulator';
}

export function resolveAgentMessageStreamUrl(
  projectId: string,
  target: 'emulator' | 'production',
): string {
  const override = process.env.AGENT_STREAM_URL?.trim();
  if (override) {
    return override;
  }
  if (target === 'emulator') {
    return `http://127.0.0.1:5001/${projectId}/${REGION}/agentMessageStream`;
  }
  return `https://${REGION}-${projectId}.cloudfunctions.net/agentMessageStream`;
}

async function signInEmulator(input: {
  email: string;
  password: string;
  apiKey: string;
}): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const url = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${input.apiKey}`;
  return signInWithPassword(url, input.email, input.password);
}

async function signInProduction(input: {
  email: string;
  password: string;
  apiKey: string;
}): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${input.apiKey}`;
  return signInWithPassword(url, input.email, input.password);
}

async function signInWithPassword(
  url: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  const payload: unknown = await response.json();
  if (!isKvRecord(payload) || typeof payload.idToken !== 'string') {
    const message =
      isKvRecord(payload) &&
      isKvRecord(payload.error) &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `Sign-in failed (${response.status})`;
    throw new Error(message);
  }
  return payload.idToken;
}

export async function mintLiveEvalIdToken(input: {
  target: 'emulator' | 'production';
}): Promise<string> {
  const preset = process.env.LANGSMITH_EVAL_ID_TOKEN?.trim();
  if (preset) {
    return preset;
  }

  const email = process.env.LANGSMITH_EVAL_EMAIL?.trim() || SEED_EMAIL;
  const password = process.env.LANGSMITH_EVAL_PASSWORD?.trim() || SEED_PASSWORD;
  const apiKey =
    process.env.NX_PUBLIC_FIREBASE_API_KEY?.trim() || 'demo-api-key-for-emulator';

  if (input.target === 'emulator') {
    return signInEmulator({ email, password, apiKey });
  }
  if (!process.env.NX_PUBLIC_FIREBASE_API_KEY?.trim()) {
    throw new Error(
      'NX_PUBLIC_FIREBASE_API_KEY is required to sign in for production live eval',
    );
  }
  return signInProduction({ email, password, apiKey });
}

function parseSseBlock(block: string): Record<string, unknown> | null {
  const lines = block.split('\n');
  let dataLine: string | undefined;

  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLine = line.slice(5).trim();
    }
  }

  if (!dataLine) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(dataLine);
    return isKvRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readDoneReply(event: Record<string, unknown>): string | null {
  if (event.type !== 'done') {
    return null;
  }
  const response = event.response;
  if (!isKvRecord(response) || typeof response.reply !== 'string') {
    return null;
  }
  return response.reply;
}

function readErrorMessage(event: Record<string, unknown>): string | null {
  if (event.type !== 'error') {
    return null;
  }
  return typeof event.message === 'string'
    ? event.message
    : 'Agent stream error';
}

export async function streamWorkspaceAgentFinalReply(input: {
  streamUrl: string;
  idToken: string;
  objective: string;
}): Promise<string> {
  const maxAttempts = 8;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await streamWorkspaceAgentFinalReplyOnce(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(message);
      const cooldown =
        message.includes('wait a moment') ||
        message.includes('cooling down');
      if (!cooldown || attempt === maxAttempts) {
        throw lastError;
      }
      const waitMs = 4000 * attempt;
      console.warn(
        `Rate limited (attempt ${attempt}/${maxAttempts}). Waiting ${waitMs}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError ?? new Error('Agent stream failed');
}

async function streamWorkspaceAgentFinalReplyOnce(input: {
  streamUrl: string;
  idToken: string;
  objective: string;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    const response = await fetch(input.streamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.idToken}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        scope: 'workspace',
        message: input.objective,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Agent request failed (${response.status})`;
      try {
        const errorBody: unknown = await response.json();
        if (
          isKvRecord(errorBody) &&
          typeof errorBody.error === 'string'
        ) {
          message = errorBody.error;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error('Agent stream body missing');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalReply: string | null = null;

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
        if (!event) {
          continue;
        }
        const errorMessage = readErrorMessage(event);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        const reply = readDoneReply(event);
        if (reply !== null) {
          finalReply = reply;
          await reader.cancel().catch(() => undefined);
          return reply;
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseBlock(buffer.trim());
      if (event) {
        const errorMessage = readErrorMessage(event);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        const reply = readDoneReply(event);
        if (reply !== null) {
          return reply;
        }
      }
    }

    if (finalReply !== null) {
      return finalReply;
    }
    throw new Error('Agent stream ended without a done event');
  } finally {
    clearTimeout(timer);
  }
}
