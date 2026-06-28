import type { GenerationKind, ILlmRoutingErrorDetails, LlmModality, LlmRoutingErrorCode } from '@shared-types';

export const USER_GROUP_ASSIGNMENT_MESSAGE =
  "Your account isn't assigned to a user group yet. Contact support.";

export const GENERATION_UNAVAILABLE_MESSAGE =
  'Generation is temporarily unavailable. Contact support.';

export class LlmRoutingError extends Error {
  readonly code: LlmRoutingErrorCode;
  readonly details: ILlmRoutingErrorDetails;

  constructor(code: LlmRoutingErrorCode, message: string, details: ILlmRoutingErrorDetails = { code }) {
    super(message);
    this.name = 'LlmRoutingError';
    this.code = code;
    this.details = { ...details, code };
  }
}

export function isLlmRoutingError(error: unknown): error is LlmRoutingError {
  return error instanceof LlmRoutingError;
}

export function createUserGroupNotAssignedError(userId: string): LlmRoutingError {
  return new LlmRoutingError(
    'USER_GROUP_NOT_ASSIGNED',
    USER_GROUP_ASSIGNMENT_MESSAGE,
    { code: 'USER_GROUP_NOT_ASSIGNED', userId }
  );
}

export function createUserGroupNotFoundError(
  userId: string,
  userGroupId: string
): LlmRoutingError {
  return new LlmRoutingError(
    'USER_GROUP_NOT_FOUND',
    USER_GROUP_ASSIGNMENT_MESSAGE,
    { code: 'USER_GROUP_NOT_FOUND', userId, userGroupId }
  );
}

export function createLlmSetupNotFoundError(
  userId: string,
  userGroupId: string,
  llmSetupId: string
): LlmRoutingError {
  return new LlmRoutingError(
    'LLM_SETUP_NOT_FOUND',
    USER_GROUP_ASSIGNMENT_MESSAGE,
    { code: 'LLM_SETUP_NOT_FOUND', userId, userGroupId, llmSetupId }
  );
}

export function createProviderNotConfiguredError(
  userId: string,
  userGroupId: string,
  llmSetupId: string,
  modality: LlmModality,
  providerType: string
): LlmRoutingError {
  return new LlmRoutingError(
    'PROVIDER_NOT_CONFIGURED',
    GENERATION_UNAVAILABLE_MESSAGE,
    {
      code: 'PROVIDER_NOT_CONFIGURED',
      userId,
      userGroupId,
      llmSetupId,
      modality,
    }
  );
}

export function createGenerationRouteNotConfiguredError(
  userId: string,
  userGroupId: string,
  llmSetupId: string,
  kind: GenerationKind,
  detail?: string
): LlmRoutingError {
  const message =
    detail ?? `Generation route ${kind} is not configured for LLM setup ${llmSetupId}.`;
  return new LlmRoutingError('GENERATION_ROUTE_NOT_CONFIGURED', message, {
    code: 'GENERATION_ROUTE_NOT_CONFIGURED',
    userId,
    userGroupId,
    llmSetupId,
    kind,
  });
}
