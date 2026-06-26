import { isLlmRoutingError } from './llm-routing-error';

export function getLlmRoutingApiError(error: unknown): {
  code: string;
  message: string;
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
} {
  const routing = getLlmRoutingApiError(error);
  if (routing) {
    return routing;
  }

  return {
    code: 'GENERATION_FAILED',
    message: error instanceof Error ? error.message : 'Generation failed',
  };
}
