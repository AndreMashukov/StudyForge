import { baseApi } from '../baseApi';
import {
  IGetAgentThreadRequest,
  IGetAgentThreadResponse,
  IListAgentThreadsRequest,
  IListAgentThreadsResponse,
} from './IAgentThreadApi';

export const agentThreadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgentThread: builder.query<
      IGetAgentThreadResponse,
      IGetAgentThreadRequest
    >({
      query: (data) => ({
        functionName: 'getAgentThread',
        data,
      }),
      providesTags: (_result, _error, arg) => [
        { type: 'AgentThread', id: arg.threadId },
      ],
    }),

    listAgentThreads: builder.query<
      IListAgentThreadsResponse,
      IListAgentThreadsRequest
    >({
      query: (data) => ({
        functionName: 'listAgentThreads',
        data,
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
