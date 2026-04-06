import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { addPendingGeneration, removePendingGeneration, ArtifactPanelType } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
import { ApiResponse } from '@shared-types';

interface ArtifactGenerationArg {
  directoryId?: string;
  documentIds: string[];
}

interface OnQueryStartedApi {
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>;
  queryFulfilled: Promise<{ data: ApiResponse<unknown> }>;
}

export function createArtifactOnQueryStarted(
  artifactType: ArtifactPanelType,
  successLabel: string,
  errorLabel: string,
) {
  return async (arg: ArtifactGenerationArg, { dispatch, queryFulfilled }: OnQueryStartedApi) => {
    if (!arg.directoryId) return;
    dispatch(addPendingGeneration({ directoryId: arg.directoryId, artifactType }));
    try {
      const { data } = await queryFulfilled;
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType }));
      if (data?.success !== false) {
        dispatch(showToast({
          message: arg.documentIds.length > 1
            ? `${successLabel} created from ${arg.documentIds.length} documents`
            : `${successLabel} created`,
          type: 'success',
        }));
      } else {
        dispatch(showToast({ message: `Failed to generate ${errorLabel}`, type: 'error' }));
      }
    } catch {
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType }));
      dispatch(showToast({ message: `Failed to generate ${errorLabel}`, type: 'error' }));
    }
  };
}
