import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { addPendingGeneration, removePendingGeneration } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';

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
) {
  return async (arg: DocumentGenerationArg, { dispatch, queryFulfilled }: OnQueryStartedApi) => {
    if (!arg.directoryId) return;
    dispatch(addPendingGeneration({ directoryId: arg.directoryId, artifactType: 'sources' }));
    try {
      await queryFulfilled;
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'sources' }));
      dispatch(showToast({
        message: `${successLabel} created successfully`,
        type: 'success',
      }));
    } catch {
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType: 'sources' }));
      dispatch(showToast({ message: `Failed to ${errorLabel}`, type: 'error' }));
    }
  };
}
