import { HttpsError } from 'firebase-functions/v2/https';
import { isLlmRoutingError } from './llm-routing-error';

const USER_GROUP_ASSIGNMENT_MESSAGE =
  "Your account isn't assigned to a user group yet. Contact support.";

export function mapLlmRoutingErrorToHttpsError(error: unknown): never {
  if (isLlmRoutingError(error)) {
    if (
      error.code === 'USER_GROUP_NOT_ASSIGNED' ||
      error.code === 'USER_GROUP_NOT_FOUND' ||
      error.code === 'LLM_SETUP_NOT_FOUND'
    ) {
      throw new HttpsError('failed-precondition', USER_GROUP_ASSIGNMENT_MESSAGE, {
        code: error.code,
        ...error.details,
      });
    }

    if (error.code === 'PROVIDER_NOT_CONFIGURED') {
      throw new HttpsError(
        'failed-precondition',
        'Generation is temporarily unavailable. Contact support.',
        {
          code: error.code,
          ...error.details,
        }
      );
    }
  }

  throw error;
}

export function wrapLlmCallable<T extends (...args: never[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      mapLlmRoutingErrorToHttpsError(error);
    }
  }) as T;
}

export { USER_GROUP_ASSIGNMENT_MESSAGE };
