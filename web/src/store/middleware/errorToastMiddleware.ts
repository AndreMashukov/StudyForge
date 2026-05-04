import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import { showToast } from '../slices/uiSlice';

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
        data?: { message?: string };
      };

      const rawMessage =
        payload?.data?.message ||
        payload?.status ||
        'An unexpected error occurred';

      // Strip prefixes like "Failed to update directory: ", "Failed to delete document: ", etc.
      const message = rawMessage.replace(/^Failed to [^:]+:\s*/i, '').trim() || rawMessage;

      api.dispatch(showToast({ message, type: 'error' }));
    }
  }

  return next(action);
};
