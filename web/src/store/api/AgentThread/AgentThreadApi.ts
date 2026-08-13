import { baseApi } from '../baseApi';
import type {
  GetAgentThreadRequest,
  GetAgentThreadResponse,
  ListAgentThreadsRequest,
  ListAgentThreadsResponse,
} from '@shared-types';

export const agentThreadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgentThread: builder.query<
      GetAgentThreadResponse,
      GetAgentThreadRequest
    >({
      query: (data) => ({
        functionName: 'getAgentThread',
        data,
      }),
      transformResponse: (
        response: GetAgentThreadResponse & { success?: boolean },
      ): GetAgentThreadResponse => ({
        thread: response.thread,
        messages: response.messages,
      }),
      providesTags: (_result, _error, arg) => [
        { type: 'AgentThread', id: arg.threadId },
      ],
    }),

    listAgentThreads: builder.query<
      ListAgentThreadsResponse,
      ListAgentThreadsRequest
    >({
      query: (data) => ({
        functionName: 'listAgentThreads',
        data,
      }),
      transformResponse: (
        response: ListAgentThreadsResponse & { success?: boolean },
      ): ListAgentThreadsResponse => ({
        threads: response.threads,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.threads.map((thread) => ({
                type: 'AgentThread' as const,
                id: thread.id,
              })),
              { type: 'AgentThread', id: 'LIST' },
            ]
          : [{ type: 'AgentThread', id: 'LIST' }],
    }),
  }),
});

export const { useGetAgentThreadQuery, useListAgentThreadsQuery } =
  agentThreadApi;
