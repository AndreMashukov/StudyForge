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
      }),
      invalidatesTags: [],
    }),
  }),
});

export const {
  useGenerateQuizFollowupMutation,
} = quizFollowupApi;