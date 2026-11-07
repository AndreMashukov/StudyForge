import { baseApi } from '../baseApi';
import type {
  IClearScratchPadAvoidedQuestionsApiResponse,
  IClearScratchPadAvoidedQuestionsRequest,
  IEvaluateScratchPadAnswerApiResponse,
  IEvaluateScratchPadAnswerRequest,
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
    clearScratchPadAvoidedQuestions: builder.mutation<
      IClearScratchPadAvoidedQuestionsApiResponse,
      IClearScratchPadAvoidedQuestionsRequest
    >({
      query: (data) => ({
        functionName: 'clearScratchPadAvoidedQuestions',
        data,
        timeout: 60_000,
      }),
    }),
    evaluateScratchPadAnswer: builder.mutation<
      IEvaluateScratchPadAnswerApiResponse,
      IEvaluateScratchPadAnswerRequest
    >({
      query: (data) => ({
        functionName: 'evaluateScratchPadAnswerCallable',
        data,
        timeout: 120_000,
      }),
    }),
  }),
});

export const {
  useRegenerateScratchPadQuestionMutation,
  useClearScratchPadAvoidedQuestionsMutation,
  useEvaluateScratchPadAnswerMutation,
} = scratchPadApi;
