import { baseApi } from "../baseApi";
import { 
  IAskDocumentQuestionRequest, 
  IAskDocumentQuestionApiResponse 
} from "./IDocumentQuestionApi";

export const documentQuestionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    askDocumentQuestion: builder.mutation<IAskDocumentQuestionApiResponse, IAskDocumentQuestionRequest>({
      query: (data) => ({
        functionName: 'askDocumentQuestion',
        data,
        timeout: 300000,
      }),
      invalidatesTags: [],
    }),
  }),
});

export const {
  useAskDocumentQuestionMutation,
} = documentQuestionApi;
