import { HttpsError } from 'firebase-functions/v2/https';
import { isLlmRoutingError } from './llm-routing-error';

interface IRateLimitErrorDetails {
  retryAfterSeconds?: number;
  generationKind?: string;
}

function isRateLimitErrorDetails(details: unknown): details is IRateLimitErrorDetails {
  return typeof details === 'object' && details !== null;
}

export function getLlmRoutingApiError(error: unknown): {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  generationKind?: string;
} | null {
  if (!isLlmRoutingError(error)) {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
  };
}

export function getGenerationFailureEnvelope(error: unknown): {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  generationKind?: string;
} {
  if (error instanceof HttpsError && error.code === 'resource-exhausted') {
    const details = isRateLimitErrorDetails(error.details) ? error.details : undefined;
    return {
      code: error.code,
      message: error.message,
      retryAfterSeconds: details?.retryAfterSeconds,
      generationKind: details?.generationKind,
    };
  }

  const routing = getLlmRoutingApiError(error);
  if (routing) {
    return routing;
  }

  return {
    code: 'GENERATION_FAILED',
    message: error instanceof Error ? error.message : 'Generation failed',
  };
}
