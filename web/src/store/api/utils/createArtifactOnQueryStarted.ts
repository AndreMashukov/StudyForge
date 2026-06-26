import { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { ApiResponse } from '@shared-types';
import { addPendingGeneration, removePendingGeneration, ArtifactPanelType } from '../../slices/artifactGenerationSlice';
import { showToast } from '../../slices/uiSlice';
import { normalizeGenerationErrorMessage } from '../../../utils/llmRoutingErrors';
import type { AppDispatch } from '../../index';
import {
  getOptimisticArtifactTitle,
  patchPendingArtifactSummaryFromResponse,
} from './artifactGenerationOptimistic';

interface ArtifactGenerationArg {
  directoryId?: string;
  documentIds: string[];
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

    dispatch(addPendingGeneration({
      directoryId: arg.directoryId,
      artifactType,
      optimisticTitle: getOptimisticArtifactTitle(arg as unknown as Record<string, unknown>),
    }));

    try {
      const { data } = await queryFulfilled;

      patchPendingArtifactSummaryFromResponse(
        dispatch as AppDispatch,
        getState,
        artifactType,
        arg.directoryId,
        arg as unknown as Record<string, unknown>,
        data,
      );

      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType }));

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
      dispatch(removePendingGeneration({ directoryId: arg.directoryId, artifactType }));
      // Error is shown via the global errorToastMiddleware toast
    }
  };
}
