import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import { getUserFacingCallableFailureMessage } from '../../utils/callableErrorMessages';
import {
  getUserFacingLlmRoutingMessage,
  normalizeGenerationErrorMessage,
} from '../../utils/llmRoutingErrors';
import { showToast } from '../slices/uiSlice';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRejectedEndpointName(action: unknown): string | undefined {
  if (
    !isRecord(action) ||
    !isRecord(action.meta) ||
    !isRecord(action.meta.arg)
  ) {
    return undefined;
  }
  const endpointName = action.meta.arg.endpointName;
  return typeof endpointName === 'string' ? endpointName : undefined;
}

function isExpectedAgentThreadNotFound(payload: {
  data?: { message?: string; code?: string };
}): boolean {
  return (
    payload.data?.code === 'NOT_FOUND' ||
    payload.data?.message === 'Thread not found' ||
    payload.data?.message === 'Agent thread not found'
  );
}

/**
 * Global RTK middleware that intercepts failed baseApi mutations/queries and
 * dispatches a toast with the actual server-side error message.
 *
 * The message is sourced from the error payload shape returned by firebaseCallableBaseQuery:
 *   { status: string; data: { message: string; code: string; details: unknown } }
 *
 * Common function-level prefixes ("Failed to update directory: ") are stripped
 * so the user sees just the actionable reason.
 */
export const errorToastMiddleware: Middleware = (api) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const actionType = (action.type as string) ?? '';

    // Only handle actions from our Firebase callable baseApi
    if (actionType.startsWith('baseApi/')) {
      const payload = action.payload as {
        status?: string;
        data?: { message?: string; code?: string; details?: { code?: string } };
      };

      if (
        getRejectedEndpointName(action) === 'getAgentThread' &&
        isExpectedAgentThreadNotFound(payload)
      ) {
        return next(action);
      }

      const routingCode = payload?.data?.code ?? payload?.data?.details?.code;
      const rawMessage =
        (typeof payload?.data?.message === 'string'
          ? payload.data.message
          : undefined) ||
        payload?.status ||
        'An unexpected error occurred';

      const message = normalizeGenerationErrorMessage(
        getUserFacingLlmRoutingMessage(routingCode, rawMessage) ??
          getUserFacingCallableFailureMessage({
            code: payload?.status,
            message: rawMessage,
          }) ??
          rawMessage,
      );

      api.dispatch(showToast({ message, type: 'error' }));
    }
  }

  return next(action);
};
