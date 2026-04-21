import { baseApi } from "../baseApi";
import { 
  IGenerateFollowupRequest, 
  IGenerateFollowupApiResponse 
} from "./IQuizFollowupApi";

export const quizFollowupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateQuizFollowup: builder.mutation<IGenerateFollowupApiResponse, IGenerateFollowupRequest>({
      query: (data) => ({
        functionName: 'generateQuizFollowup',
        data,
        // Server-side timeout is 300s; override the 70s client-side default to match.
        timeout: 300000,
      }),
      invalidatesTags: [],
    }),
  }),
});

export const {
  useGenerateQuizFollowupMutation,
} = quizFollowupApi;