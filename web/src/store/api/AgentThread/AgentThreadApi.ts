import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  getAgentThreadFromFirestore,
  listAgentThreadsFromFirestore,
} from '../../../services/agentThreadFirestore';
import {
  authRequiredError,
  customError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import type {
  GetAgentThreadRequest,
  GetAgentThreadResponse,
  ListAgentThreadsRequest,
  ListAgentThreadsResponse,
} from '@shared-types';

function mutationError(error: unknown) {
  return customError(error instanceof Error ? error.message : 'Unknown error');
}

export const agentThreadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgentThread: builder.query<GetAgentThreadResponse, GetAgentThreadRequest>({
      async queryFn({ threadId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await getAgentThreadFromFirestore(userId, threadId);
          if (!result) return notFoundError('Thread not found');
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'AgentThread', id: arg.threadId },
      ],
    }),

    listAgentThreads: builder.query<ListAgentThreadsResponse, ListAgentThreadsRequest>({
      async queryFn(args) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const threads = await listAgentThreadsFromFirestore(userId, args.limit);
          return { data: { threads } };
        } catch (error) {
          return mutationError(error);
        }
      },
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

export const { useGetAgentThreadQuery, useListAgentThreadsQuery } = agentThreadApi;
