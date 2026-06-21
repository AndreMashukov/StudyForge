import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { addPendingGeneration, removePendingGeneration } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
import { getOptimisticArtifactTitle } from './artifactGenerationOptimistic';

interface DocumentGenerationArg {
  directoryId?: string;
}

interface OnQueryStartedApi {
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>;
  queryFulfilled: Promise<{ data: unknown }>;
}

export function createDocumentOnQueryStarted(
  successLabel: string,
  errorLabel: string,
  options?: { successMessage?: string },
) {
  return async (arg: DocumentGenerationArg, { dispatch, queryFulfilled }: OnQueryStartedApi) => {
    if (!arg.directoryId) return;
    dispatch(addPendingGeneration({
      directoryId: arg.directoryId,
      artifactType: 'sources',
      optimisticTitle: getOptimisticArtifactTitle(arg as Record<string, unknown>),
    }));
    try {
      await queryFulfilled;
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'sources' }));
      dispatch(showToast({
        message: options?.successMessage || `${successLabel} created successfully`,
        type: 'success',
      }));
    } catch {
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'sources' }));
      // Error is shown via the global errorToastMiddleware toast
    }
  };
}
