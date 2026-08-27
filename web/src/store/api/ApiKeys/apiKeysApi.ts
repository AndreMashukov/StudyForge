import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import { listApiKeysFromFirestore } from '../../../services/apiKeysFirestore';
import {
  authRequiredError,
  customError,
} from '../../../services/firestoreReadUtils';
import { IApiKey, ICreateApiKeyResponse } from './IApiKeysApi';
import { IBulkOperationResponse, IBulkRevokeApiKeysRequest } from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const apiKeysApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listApiKeys: builder.query<{ keys: IApiKey[] }, void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const keys = await listApiKeysFromFirestore(userId);
          return { data: { keys } };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: ['ApiKeys'],
    }),

    createApiKey: builder.mutation<ICreateApiKeyResponse, { name: string }>({
      query: (data) => ({
        functionName: 'createApiKey',
        data,
      }),
      invalidatesTags: ['ApiKeys'],
    }),

    revokeApiKey: builder.mutation<{ success: boolean }, { keyId: string }>({
      query: (data) => ({
        functionName: 'revokeApiKey',
        data,
      }),
      invalidatesTags: ['ApiKeys'],
    }),

    bulkRevokeApiKeys: builder.mutation<IBulkOperationResponse, IBulkRevokeApiKeysRequest>({
      query: (data) => ({
        functionName: 'bulkRevokeApiKeys',
        data,
      }),
      invalidatesTags: (result) =>
        result && result.succeeded > 0 ? ['ApiKeys'] : [],
    }),
  }),
});

export const {
  useListApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useBulkRevokeApiKeysMutation,
} = apiKeysApi;
