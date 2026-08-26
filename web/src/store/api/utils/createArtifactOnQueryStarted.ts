import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { ApiResponse } from '@shared-types';
import { addPendingGeneration, removePendingGeneration, ArtifactPanelType } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
import { normalizeGenerationErrorMessage } from '../../../utils/llmRoutingErrors';
import type { AppDispatch } from '../../index';
import {
  getOptimisticArtifactTitle,
  IOptimisticTitleInput,
  patchPendingArtifactSummaryFromResponse,
} from './artifactGenerationOptimistic';

interface ArtifactGenerationArg extends IOptimisticTitleInput {
  directoryId?: string;
  documentIds: string[];
  ruleIds?: string[];
}

interface CreateArtifactOnQueryStartedOptions {
  successMessage?: string | ((arg: ArtifactGenerationArg) => string);
}

export function createArtifactOnQueryStarted(
  artifactType: ArtifactPanelType,
  successLabel: string,
  errorLabel: string,
  options?: CreateArtifactOnQueryStartedOptions,
) {
  return async (
    arg: ArtifactGenerationArg,
    {
      dispatch,
      queryFulfilled,
      getState,
    }: {
      dispatch: ThunkDispatch<unknown, unknown, UnknownAction>;
      queryFulfilled: Promise<{ data: ApiResponse<unknown> }>;
      getState: () => unknown;
    },
  ) => {
    if (!arg.directoryId) return;

    const id = crypto.randomUUID();
    dispatch(addPendingGeneration({
      id,
      directoryId: arg.directoryId,
      artifactType,
      optimisticTitle: getOptimisticArtifactTitle(arg),
    }));

    try {
      const { data } = await queryFulfilled;

      patchPendingArtifactSummaryFromResponse(
        dispatch as AppDispatch,
        getState,
        artifactType,
        arg.directoryId,
        arg,
        data,
      );

      dispatch(removePendingGeneration({ id }));

      if (data?.success !== false) {
        const message = typeof options?.successMessage === 'function'
          ? options.successMessage(arg)
          : options?.successMessage ?? (
            arg.documentIds.length > 1
              ? `${successLabel} created from ${arg.documentIds.length} documents`
              : `${successLabel} created`
          );

        dispatch(showToast({ message, type: 'success' }));
      } else {
        const errorMessage =
          typeof data?.error === 'object' &&
          data.error !== null &&
          'message' in data.error &&
          typeof data.error.message === 'string'
            ? normalizeGenerationErrorMessage(data.error.message)
            : `Failed to generate ${errorLabel}`;

        dispatch(showToast({ message: errorMessage, type: 'error' }));
      }
    } catch {
      dispatch(removePendingGeneration({ id }));
      // Error is shown via the global errorToastMiddleware toast
    }
  };
}
