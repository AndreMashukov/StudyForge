import { mapErrorToArtifactEnvelope } from '../../lib/callable-error';
import { isLlmRoutingError } from './llm-routing-error';

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
  const routing = getLlmRoutingApiError(error);
  if (routing) {
    return routing;
  }

  return mapErrorToArtifactEnvelope(error, 'GENERATION_FAILED');
}
