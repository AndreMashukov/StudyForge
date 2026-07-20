import { baseApi } from '../baseApi';
import { IApiKey, ICreateApiKeyResponse } from './IApiKeysApi';
import { IBulkOperationResponse, IBulkRevokeApiKeysRequest } from '@shared-types';

export const apiKeysApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listApiKeys: builder.query<{ keys: IApiKey[] }, void>({
      query: () => ({
        functionName: 'listApiKeys',
        data: {},
      }),
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
