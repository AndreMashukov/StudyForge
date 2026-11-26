import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  getAgentThreadFromFirestore,
  listAgentThreadsFromFirestore,
  subscribeDirectoryAgentThreads,
} from '../../../services/agentThreadFirestore';
import {
  createAgentThreadMessageSync,
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
  ISuggestedAgentPrompt,
  ListSuggestedAgentPromptsResponse,
  StartAgentTurnResponse,
} from '@shared-types';
import type {
  IGetAgentTurnRequest,
  IListDirectoryAgentThreadsRequest,
} from './IAgentThreadApi';

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
      // Live thread doc (title, preview, activeTurnId). Messages are re-read
      // from the server when lastMessageAt moves, not listened to.
      async onCacheEntryAdded(
        { threadId },
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

        const messageSync = createAgentThreadMessageSync({
          userId,
          threadId,
          onMessages: (messages) => {
            updateCachedData((draft) => {
              draft.messages = messages;
            });
          },
        });
        const unsubscribe = subscribeAgentThread(userId, threadId, {
          onThread: (thread, meta) => {
            if (!thread || meta.fromCache) {
              return;
            }
            updateCachedData((draft) => {
              draft.thread = thread;
            });
            messageSync.onThread(thread);
          },
        });

        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
          messageSync.dispose();
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

    /** Threads started in a folder (home folder), newest message first; live. */
    listDirectoryAgentThreads: builder.query<
      ListAgentThreadsResponse,
      IListDirectoryAgentThreadsRequest
    >({
      async queryFn({ directoryId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const threads = await new Promise<ListAgentThreadsResponse['threads']>(
            (resolve, reject) => {
              const unsubscribe = subscribeDirectoryAgentThreads(userId, directoryId, {
                onThreads: (next) => {
                  unsubscribe();
                  resolve(next);
                },
                onError: (error) => {
                  unsubscribe();
                  reject(error);
                },
              });
            },
          );
          return { data: { threads } };
        } catch (error) {
          return mutationError(error);
        }
      },
      async onCacheEntryAdded(
        { directoryId },
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
        const unsubscribe = subscribeDirectoryAgentThreads(userId, directoryId, {
          onThreads: (threads) => {
            updateCachedData(() => ({ threads }));
          },
        });
        try {
          await cacheEntryRemoved;
        } finally {
          unsubscribe();
        }
      },
      providesTags: (_result, _error, { directoryId }) => [
        { type: 'AgentThread', id: `DIRECTORY:${directoryId}` },
      ],
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

    /** Suggested agent prompts for the "/" menu (published agent blueprints, ADR 017). */
    listSuggestedAgentPrompts: builder.query<ISuggestedAgentPrompt[], void>({
      query: () => ({
        functionName: 'listSuggestedAgentPrompts',
        data: {},
        timeout: 30000,
      }),
      transformResponse: (response: ListSuggestedAgentPromptsResponse) =>
        response.prompts ?? [],
      keepUnusedDataFor: 600,
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
  useListDirectoryAgentThreadsQuery,
  useGetAgentTurnQuery,
  useStartAgentTurnMutation,
  useCancelAgentTurnMutation,
  useListSuggestedAgentPromptsQuery,
} = agentThreadApi;
