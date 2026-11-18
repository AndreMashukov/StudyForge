import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  getAgentThreadFromFirestore,
  listAgentThreadMessages,
  listAgentThreadsFromFirestore,
} from '../../../services/agentThreadFirestore';
import {
  getAgentTurnFromFirestore,
  subscribeAgentThread,
  subscribeAgentTurn,
} from '../../../services/agentTurnFirestore';
import {
  authRequiredError,
  customError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import type {
  AgentTurn,
  CancelAgentTurnRequest,
  CancelAgentTurnResponse,
  GetAgentThreadRequest,
  GetAgentThreadResponse,
  ListAgentThreadsRequest,
  ListAgentThreadsResponse,
  StartAgentTurnRequest,
  StartAgentTurnResponse,
} from '@shared-types';
import type { IGetAgentTurnRequest } from './IAgentThreadApi';

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
      // Live thread doc (title, preview, activeTurnId). Messages are refetched
      // when a turn writes one (lastMessageAt moves), not listened to.
      async onCacheEntryAdded(
        { threadId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved, getCacheEntry },
      ) {
        try {
          await cacheDataLoaded;
        } catch {
          return;
        }
        const userId = auth.currentUser?.uid;
        if (!userId) {
          await cacheEntryRemoved;
          return;
        }

        let refetchSeq = 0;
        const unsubscribe = subscribeAgentThread(userId, threadId, {
          onThread: (thread, meta) => {
            if (!thread || meta.fromCache) {
              return;
            }
            const previous = getCacheEntry().data?.thread;
            updateCachedData((draft) => {
              draft.thread = thread;
            });
            if (previous?.lastMessageAt === thread.lastMessageAt) {
              return;
            }
            const seq = ++refetchSeq;
            void listAgentThreadMessages(userId, threadId)
              .then((messages) => {
                if (seq !== refetchSeq) {
                  return;
                }
                updateCachedData((draft) => {
                  draft.messages = messages;
                });
              })
              .catch(() => undefined);
          },
        });

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
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

    /** One durable agent turn, kept live while the panel follows it. */
    getAgentTurn: builder.query<AgentTurn | null, IGetAgentTurnRequest>({
      async queryFn({ threadId, turnId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const turn = await getAgentTurnFromFirestore(userId, threadId, turnId);
          return { data: turn };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { threadId, turnId },
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded;
        } catch {
          return;
        }
        const userId = auth.currentUser?.uid;
        if (!userId) {
          await cacheEntryRemoved;
          return;
        }

        const unsubscribe = subscribeAgentTurn(userId, threadId, turnId, {
          onTurn: (turn, meta) => {
            // A cached snapshot can show a stale "running" turn; wait for the server.
            if (!turn || meta.fromCache) {
              return;
            }
            updateCachedData(() => turn);
          },
        });

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
      keepUnusedDataFor: 30,
    }),

    startAgentTurn: builder.mutation<StartAgentTurnResponse, StartAgentTurnRequest>({
      query: (data) => ({
        functionName: 'startAgentTurn',
        data,
        timeout: 30000,
      }),
      invalidatesTags: [{ type: 'AgentThread', id: 'LIST' }],
    }),

    cancelAgentTurn: builder.mutation<CancelAgentTurnResponse, CancelAgentTurnRequest>({
      query: (data) => ({
        functionName: 'cancelAgentTurn',
        data,
        timeout: 30000,
      }),
    }),
  }),
});

export const {
  useGetAgentThreadQuery,
  useListAgentThreadsQuery,
  useGetAgentTurnQuery,
  useStartAgentTurnMutation,
  useCancelAgentTurnMutation,
} = agentThreadApi;
