import {
  isFulfilled,
  isPending,
  isRejected,
  Middleware,
  UnknownAction,
} from '@reduxjs/toolkit';
import { setLoading } from '../slices/uiSlice';

/**
 * Allowlisted baseApi mutations that block the full viewport while pending.
 * Keep this list in sync with the grilling decision for global submit locking.
 */
export const LOADING_OVERLAY_MUTATIONS = new Set<string>([
  'createDirectory',
  'deleteDirectory',
  'updateRule',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnknownAction(action: unknown): action is UnknownAction {
  return isRecord(action) && typeof action.type === 'string';
}

function isBaseApiMutationLifecycle(action: UnknownAction): boolean {
  return (
    typeof action.type === 'string' &&
    action.type.startsWith('baseApi/executeMutation/')
  );
}

function getEndpointName(action: UnknownAction): string | undefined {
  if (!('meta' in action) || !isRecord(action.meta)) {
    return undefined;
  }

  const { arg } = action.meta;
  if (!isRecord(arg)) {
    return undefined;
  }

  const { endpointName } = arg;
  return typeof endpointName === 'string' ? endpointName : undefined;
}

/**
 * Refcounts allowlisted mutation lifecycle actions and drives uiSlice.isLoading
 * so a single GlobalLoadingOverlay can block the viewport for the duration.
 */
export const loadingOverlayMiddleware: Middleware = (api) => {
  let pendingCount = 0;

  return (next) => (action) => {
    const result = next(action);

    if (!isUnknownAction(action) || !isBaseApiMutationLifecycle(action)) {
      return result;
    }

    const endpointName = getEndpointName(action);
    if (!endpointName || !LOADING_OVERLAY_MUTATIONS.has(endpointName)) {
      return result;
    }

    if (isPending(action)) {
      pendingCount += 1;
      if (pendingCount === 1) {
        api.dispatch(setLoading({ isLoading: true, message: 'Working…' }));
      }
    } else if (isFulfilled(action) || isRejected(action)) {
      pendingCount = Math.max(0, pendingCount - 1);
      if (pendingCount === 0) {
        api.dispatch(setLoading({ isLoading: false }));
      }
    }

    return result;
  };
};
