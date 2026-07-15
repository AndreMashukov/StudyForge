import { HttpsError, FunctionsErrorCode } from 'firebase-functions/v2/https';

export interface IArtifactErrorEnvelope {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  generationKind?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRateLimitErrorDetails(details: unknown): details is {
  retryAfterSeconds?: number;
  generationKind?: string;
} {
  return typeof details === 'object' && details !== null;
}

export function inferHttpsErrorCode(message: string): FunctionsErrorCode {
  const lower = message.toLowerCase();

  if (
    lower.includes('authentication required')
    || lower.includes('must be called while authenticated')
  ) {
    return 'unauthenticated';
  }

  if (/\bnot found\b/.test(lower) || /\bdoes not exist\b/.test(lower)) {
    return 'not-found';
  }

  if (
    lower.includes('already exists')
    || lower.includes('cannot move directory to its own descendant')
  ) {
    return 'already-exists';
  }

  if (
    lower.includes('already failed')
    || lower.includes('not ready')
    || lower.includes('has no content')
    || lower.includes('before starting')
    || lower.includes('exceeds maximum directory depth')
    || lower.includes('maximum directory depth')
    || lower.includes('unsupported generation')
    || lower.includes('live mode is not supported')
  ) {
    return 'failed-precondition';
  }

  if (
    /\bis required\b/.test(lower)
    || /\bmust be\b/.test(lower)
    || /\bmissing required\b/.test(lower)
    || /\bcannot exceed\b/.test(lower)
    || /\bcannot be empty\b/.test(lower)
    || /\bcharacters or less\b/.test(lower)
    || /\bmust be an array\b/.test(lower)
    || /\beach .+ must be\b/.test(lower)
    || /\bmaximum \d+\b/.test(lower)
    || /\binvalid\b/.test(lower)
  ) {
    return 'invalid-argument';
  }

  return 'internal';
}

export function mapErrorToHttpsError(
  error: unknown,
  fallbackMessage = 'Unknown error'
): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }

  const message = getErrorMessage(error);
  const code = inferHttpsErrorCode(message);
  return new HttpsError(code, message || fallbackMessage);
}

export function throwCallableError(
  error: unknown,
  fallbackMessage = 'Unknown error'
): never {
  throw mapErrorToHttpsError(error, fallbackMessage);
}

function httpsCodeToArtifactCode(
  code: FunctionsErrorCode,
  message: string,
  defaultCode: string
): string {
  switch (code) {
    case 'unauthenticated':
      return 'UNAUTHENTICATED';
    case 'not-found':
      return 'NOT_FOUND';
    case 'invalid-argument':
      return /\bis required\b/i.test(message) ? 'MISSING_PARAMETER' : 'INVALID_ARGUMENT';
    case 'failed-precondition':
      return 'FAILED_PRECONDITION';
    case 'already-exists':
      return 'ALREADY_EXISTS';
    case 'resource-exhausted':
      return 'resource-exhausted';
    case 'internal':
    default:
      return defaultCode;
  }
}

export function mapErrorToArtifactEnvelope(
  error: unknown,
  defaultCode = 'FETCH_FAILED'
): IArtifactErrorEnvelope {
  if (error instanceof HttpsError) {
    if (error.code === 'resource-exhausted') {
      const details = isRateLimitErrorDetails(error.details) ? error.details : undefined;
      return {
        code: error.code,
        message: error.message,
        retryAfterSeconds: details?.retryAfterSeconds,
        generationKind: details?.generationKind,
      };
    }

    return {
      code: httpsCodeToArtifactCode(error.code, error.message, defaultCode),
      message: error.message,
    };
  }

  const httpsError = mapErrorToHttpsError(error);
  return {
    code: httpsCodeToArtifactCode(httpsError.code, httpsError.message, defaultCode),
    message: httpsError.message,
  };
}
