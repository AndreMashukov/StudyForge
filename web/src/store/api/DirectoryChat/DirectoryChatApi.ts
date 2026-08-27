import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  getDirectoryChatFromFirestore,
  updateDirectoryChatSourcesInFirestore,
} from '../../../services/directoryChatFirestore';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import {
  IGetDirectoryChatApiResponse,
  IGetDirectoryChatRequest,
  ISendDirectoryChatMessageApiResponse,
  ISendDirectoryChatMessageRequest,
  IUpdateDirectoryChatSourcesApiResponse,
  IUpdateDirectoryChatSourcesRequest,
} from './IDirectoryChatApi';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const directoryChatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDirectoryChat: builder.query<IGetDirectoryChatApiResponse, IGetDirectoryChatRequest>({
      async queryFn({ directoryId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const data = await getDirectoryChatFromFirestore(userId, directoryId);
          return { data };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, arg) => [
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
      invalidatesTags: (_result, _error, arg) => [
        { type: 'DirectoryChat', id: arg.directoryId },
      ],
    }),

    updateDirectoryChatSources: builder.mutation<
      IUpdateDirectoryChatSourcesApiResponse,
      IUpdateDirectoryChatSourcesRequest
    >({
      async queryFn({ directoryId, selectedDocumentIds }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const data = await updateDirectoryChatSourcesInFirestore(
            userId,
            directoryId,
            selectedDocumentIds,
          );
          return { data };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'DirectoryChat', id: arg.directoryId },
      ],
    }),
  }),
});

export const {
  useGetDirectoryChatQuery,
  useSendDirectoryChatMessageMutation,
  useUpdateDirectoryChatSourcesMutation,
} = directoryChatApi;
