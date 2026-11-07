import { baseApi } from '../baseApi';
import type {
  IRegenerateScratchPadQuestionApiResponse,
  IRegenerateScratchPadQuestionRequest,
} from './IScratchPadApi';

export const scratchPadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    regenerateScratchPadQuestion: builder.mutation<
      IRegenerateScratchPadQuestionApiResponse,
      IRegenerateScratchPadQuestionRequest
    >({
      query: (data) => ({
        functionName: 'regenerateScratchPadQuestion',
        data,
        timeout: 120_000,
      }),
    }),
  }),
});

export const { useRegenerateScratchPadQuestionMutation } = scratchPadApi;
