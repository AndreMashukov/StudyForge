import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { addPendingGeneration, removePendingGeneration } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
import { getOptimisticArtifactTitle, IOptimisticTitleInput } from './artifactGenerationOptimistic';

interface DocumentGenerationArg extends IOptimisticTitleInput {
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
    const id = crypto.randomUUID();
    dispatch(addPendingGeneration({
      id,
      directoryId: arg.directoryId,
      artifactType: 'sources',
      optimisticTitle: getOptimisticArtifactTitle(arg),
    }));
    try {
      await queryFulfilled;
      dispatch(removePendingGeneration({ id }));
      dispatch(showToast({
        message: options?.successMessage || `${successLabel} created successfully`,
        type: 'success',
      }));
    } catch {
      dispatch(removePendingGeneration({ id }));
      // Error is shown via the global errorToastMiddleware toast
    }
  };
}
