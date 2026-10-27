import {
  auth,
  ensureAppCheckToken,
  firebaseProjectId,
  useEmulator,
} from '../config/firebase';

const FUNCTIONS_REGION = 'asia-east1';
const DEFAULT_TIMEOUT_MS = 70_000;

const HTTP_STATUS_TO_CODE: Record<number, string> = {
  0: 'internal',
  400: 'invalid-argument',
  401: 'unauthenticated',
  403: 'permission-denied',
  404: 'not-found',
  409: 'aborted',
  429: 'resource-exhausted',
  499: 'cancelled',
  500: 'internal',
  501: 'unimplemented',
  503: 'unavailable',
  504: 'deadline-exceeded',
};

const BODY_STATUS_TO_CODE: Record<string, string> = {
  OK: 'ok',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
  INVALID_ARGUMENT: 'invalid-argument',
  DEADLINE_EXCEEDED: 'deadline-exceeded',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  PERMISSION_DENIED: 'permission-denied',
  UNAUTHENTICATED: 'unauthenticated',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  FAILED_PRECONDITION: 'failed-precondition',
  ABORTED: 'aborted',
  OUT_OF_RANGE: 'out-of-range',
  UNIMPLEMENTED: 'unimplemented',
  INTERNAL: 'internal',
  UNAVAILABLE: 'unavailable',
  DATA_LOSS: 'data-loss',
};

export class CallableRequestError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'CallableRequestError';
    this.code = `functions/${code}`;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getCallableUrl(functionName: string): string {
  if (useEmulator) {
    return `http://127.0.0.1:5001/${firebaseProjectId}/${FUNCTIONS_REGION}/${functionName}`;
  }
  return `https://${FUNCTIONS_REGION}-${firebaseProjectId}.cloudfunctions.net/${functionName}`;
}

function codeForHttpStatus(status: number): string {
  if (status >= 200 && status < 300) {
    return 'ok';
  }
  return HTTP_STATUS_TO_CODE[status] ?? 'unknown';
}

function errorFromBody(
  status: number,
  body: unknown,
): CallableRequestError | null {
  let code = codeForHttpStatus(status);
  let message = code;
  let details: unknown;

  if (isRecord(body) && isRecord(body.error)) {
    const statusName = body.error.status;
    if (typeof statusName === 'string') {
      const mapped = BODY_STATUS_TO_CODE[statusName];
      if (!mapped) {
        return new CallableRequestError('internal', 'internal');
      }
      code = mapped;
      message = statusName;
    }
    if (typeof body.error.message === 'string') {
      message = body.error.message;
    }
    details = body.error.details;
  }

  if (code === 'ok') {
    return null;
  }
  return new CallableRequestError(code, message, details);
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

/**
 * Calls a Firebase callable over HTTP and sets X-Firebase-AppCheck from the
 * token we already fetched.
 *
 * httpsCallable in firebase-js-sdk 12.x (and current main) leaves that header
 * off when its internal App Check handle is still unset, then sends the
 * request anyway. Enforced functions answer 401 with app: MISSING.
 */
export async function callCallable(
  functionName: string,
  data: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const appCheckToken = await ensureAppCheckToken();
  const idToken = await auth.currentUser?.getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  let response: Response;
  try {
    response = await fetch(getCallableUrl(functionName), {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: data ?? {} }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      throw new CallableRequestError('deadline-exceeded', 'deadline-exceeded');
    }
    const message = error instanceof Error ? error.message : 'internal';
    throw new CallableRequestError('unavailable', message);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const callError = errorFromBody(response.status, body);
  if (callError) {
    throw callError;
  }

  if (!isRecord(body)) {
    throw new CallableRequestError(
      'internal',
      'Response is not valid JSON object.',
    );
  }
  if ('data' in body) {
    return body.data;
  }
  if ('result' in body) {
    return body.result;
  }
  throw new CallableRequestError('internal', 'Response is missing data field.');
}
