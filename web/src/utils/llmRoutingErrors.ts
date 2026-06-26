import type { LlmRoutingErrorCode } from '@shared-types';

export const USER_GROUP_ASSIGNMENT_MESSAGE =
  "Your account isn't assigned to a user group yet. Contact support.";

export const GENERATION_UNAVAILABLE_MESSAGE =
  'Generation is temporarily unavailable. Contact support.';

const ROUTING_ERROR_MESSAGES: Record<LlmRoutingErrorCode, string> = {
  USER_GROUP_NOT_ASSIGNED: USER_GROUP_ASSIGNMENT_MESSAGE,
  USER_GROUP_NOT_FOUND: USER_GROUP_ASSIGNMENT_MESSAGE,
  LLM_SETUP_NOT_FOUND: USER_GROUP_ASSIGNMENT_MESSAGE,
  PROVIDER_NOT_CONFIGURED: GENERATION_UNAVAILABLE_MESSAGE,
};

export function getUserFacingLlmRoutingMessage(
  code: unknown,
  fallbackMessage?: string
): string | undefined {
  if (typeof code === 'string' && code in ROUTING_ERROR_MESSAGES) {
    return ROUTING_ERROR_MESSAGES[code as LlmRoutingErrorCode];
  }

  if (fallbackMessage === USER_GROUP_ASSIGNMENT_MESSAGE) {
    return fallbackMessage;
  }

  if (fallbackMessage === GENERATION_UNAVAILABLE_MESSAGE) {
    return fallbackMessage;
  }

  return undefined;
}

export function normalizeGenerationErrorMessage(rawMessage: unknown): string {
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return 'An unexpected error occurred';
  }

  const mapped = getUserFacingLlmRoutingMessage(undefined, rawMessage);
  if (mapped) {
    return mapped;
  }

  return rawMessage.replace(/^Failed to [^:]+:\s*/i, '').trim() || rawMessage;
}
