import { baseApi } from '../baseApi';
import {
  IGetDirectoryChatApiResponse,
  IGetDirectoryChatRequest,
  ISendDirectoryChatMessageApiResponse,
  ISendDirectoryChatMessageRequest,
} from './IDirectoryChatApi';

export const directoryChatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDirectoryChat: builder.query<IGetDirectoryChatApiResponse, IGetDirectoryChatRequest>({
      query: (data) => ({
        functionName: 'getDirectoryChat',
        data,
      }),
      providesTags: (result, error, arg) => [
        { type: 'DirectoryChat', id: arg.directoryId },
      ],
    }),

    sendDirectoryChatMessage: builder.mutation<
      ISendDirectoryChatMessageApiResponse,
      ISendDirectoryChatMessageRequest
    >({
      query: (data) => ({
        functionName: 'sendDirectoryChatMessage',
        data,
        timeout: 300000,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DirectoryChat', id: arg.directoryId },
      ],
    }),
  }),
});

export const {
  useGetDirectoryChatQuery,
  useSendDirectoryChatMessageMutation,
} = directoryChatApi;
