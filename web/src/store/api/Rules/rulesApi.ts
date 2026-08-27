import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  resolveApplicableRulesClient,
  resolveDirectoryRulesClient,
} from '../../../services/directoryRulesResolution';
import {
  fetchRuleFromFirestore,
  fetchRulesFromFirestore,
  fetchRuleTagsFromFirestore,
} from '../../../services/rulesFirestore';
import {
  createRuleInFirestore,
  updateRuleInFirestore,
  deleteRuleInFirestore,
  attachRuleToDirectoryInFirestore,
  detachRuleFromDirectoryInFirestore,
  formatRulesForPromptClient,
} from '../../../services/rulesMutations';
import { executeBulkOperation } from '../../../services/bulkOperation';
import {
  authRequiredError,
  customError,
  notFoundError,
} from '../../../services/firestoreReadUtils';
import {
  Rule,
  CreateRuleRequest,
  UpdateRuleRequest,
  DeleteRuleRequest,
  DeleteRuleResponse,
  AttachRuleToDirectoryRequest,
  DetachRuleFromDirectoryRequest,
  GetDirectoryRulesRequest,
  GetDirectoryRulesResponse,
  GetApplicableRulesRequest,
  FormatRulesForPromptRequest,
  IBulkDeleteRulesRequest,
  IBulkDetachRulesFromDirectoryRequest,
  IBulkOperationResponse,
} from '@shared-types';
import { GetApplicableRulesWithDefaultsResponse } from './IRulesApi';

function firestoreReadError(message: string) {
  return customError(message);
}

function mutationError(error: unknown) {
  return customError(
    error instanceof Error ? error.message : 'Unknown error',
  );
}

function getFirestoreErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export const rulesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRules: builder.query<Rule[], void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const rules = await fetchRulesFromFirestore(userId);
          return { data: rules };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load rules from Firestore'),
          );
        }
      },
      providesTags: ['Rules'],
      keepUnusedDataFor: 300,
    }),

    getRule: builder.query<Rule, string>({
      async queryFn(ruleId) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const rule = await fetchRuleFromFirestore(userId, ruleId);
          if (!rule) return notFoundError('Rule not found');
          return { data: rule };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load rule from Firestore'),
          );
        }
      },
      providesTags: (_result, _error, ruleId) => [{ type: 'Rules', id: ruleId }],
      keepUnusedDataFor: 300,
    }),

    createRule: builder.mutation<Rule, CreateRuleRequest>({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const rule = await createRuleInFirestore(userId, data);
          return { data: rule };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: ['Rules'],
    }),

    updateRule: builder.mutation<Rule, UpdateRuleRequest>({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const rule = await updateRuleInFirestore(userId, data);
          return { data: rule };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
        'DirectoryRules',
      ],
    }),

    deleteRule: builder.mutation<DeleteRuleResponse, DeleteRuleRequest>({
      async queryFn({ ruleId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await deleteRuleInFirestore(userId, ruleId);
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (result) => (result?.success ? ['Rules'] : []),
    }),

    attachRuleToDirectory: builder.mutation<void, AttachRuleToDirectoryRequest>({
      async queryFn({ ruleId, directoryId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await attachRuleToDirectoryInFirestore(userId, ruleId, directoryId);
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
        'DirectoryRules',
      ],
    }),

    detachRuleFromDirectory: builder.mutation<void, DetachRuleFromDirectoryRequest>({
      async queryFn({ ruleId, directoryId }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          await detachRuleFromDirectoryInFirestore(userId, ruleId, directoryId);
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
        'DirectoryRules',
      ],
    }),

    bulkDeleteRules: builder.mutation<IBulkOperationResponse, IBulkDeleteRulesRequest>({
      async queryFn({ ruleIds }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await executeBulkOperation({
            items: ruleIds,
            getItemId: (id) => id,
            runItem: async (ruleId) => {
              const response = await deleteRuleInFirestore(userId, ruleId);
              if (!response.success) {
                throw new Error(response.error ?? 'Failed to delete rule');
              }
            },
          });
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (result) => (result && result.succeeded > 0 ? ['Rules'] : []),
    }),

    bulkDetachRulesFromDirectory: builder.mutation<
      IBulkOperationResponse,
      IBulkDetachRulesFromDirectoryRequest
    >({
      async queryFn({ directoryId, ruleIds }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const result = await executeBulkOperation({
            items: ruleIds,
            getItemId: (id) => id,
            runItem: (ruleId) =>
              detachRuleFromDirectoryInFirestore(userId, ruleId, directoryId),
          });
          return { data: result };
        } catch (error) {
          return mutationError(error);
        }
      },
      invalidatesTags: (result) =>
        result && result.succeeded > 0 ? ['Rules', 'DirectoryRules'] : [],
    }),

    getDirectoryRules: builder.query<GetDirectoryRulesResponse, GetDirectoryRulesRequest>({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        if (!data.directoryId) return firestoreReadError('Directory ID is required');

        try {
          const resolved = await resolveDirectoryRulesClient(userId, data.directoryId, {
            includeAncestors: data.includeAncestors,
          });
          return { data: resolved };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load directory rules from Firestore'),
          );
        }
      },
      providesTags: (_result, _error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: arg.directoryId },
      ],
      keepUnusedDataFor: 300,
    }),

    getApplicableRules: builder.query<
      GetApplicableRulesWithDefaultsResponse,
      GetApplicableRulesRequest
    >({
      async queryFn(data) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        if (!data.directoryId || !data.operation) {
          return firestoreReadError('Directory ID and operation are required');
        }

        try {
          const resolved = await resolveApplicableRulesClient(
            userId,
            data.directoryId,
            data.operation,
          );
          return { data: resolved };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load applicable rules from Firestore'),
          );
        }
      },
      providesTags: (_result, _error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: `${arg.directoryId}-${arg.operation}` },
      ],
      keepUnusedDataFor: 300,
    }),

    formatRulesForPrompt: builder.mutation<string, FormatRulesForPromptRequest>({
      async queryFn({ ruleIds }) {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();
        try {
          const formattedRules = await formatRulesForPromptClient(userId, ruleIds);
          return { data: formattedRules };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),

    getRuleTags: builder.query<string[], void>({
      async queryFn() {
        const userId = auth.currentUser?.uid;
        if (!userId) return authRequiredError();

        try {
          const tags = await fetchRuleTagsFromFirestore(userId);
          return { data: tags };
        } catch (error) {
          return firestoreReadError(
            getFirestoreErrorMessage(error, 'Failed to load rule tags from Firestore'),
          );
        }
      },
      providesTags: ['Rules'],
      keepUnusedDataFor: 300,
    }),

    generateRuleWithAI: builder.mutation<
      { name: string; description: string; content: string },
      {
        topic: string;
        description?: string;
        applicableTo?: string[];
        existingContent?: string;
      }
    >({
      query: (data) => ({
        functionName: 'generateRuleWithAI',
        data,
        timeout: 300000,
      }),
      transformResponse: (response: {
        success: boolean;
        result: { name: string; description: string; content: string };
      }) => response.result,
    }),
  }),
});

export const {
  useGetRulesQuery,
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
  useAttachRuleToDirectoryMutation,
  useDetachRuleFromDirectoryMutation,
  useBulkDeleteRulesMutation,
  useBulkDetachRulesFromDirectoryMutation,
  useGetDirectoryRulesQuery,
  useGetApplicableRulesQuery,
  useFormatRulesForPromptMutation,
  useGetRuleTagsQuery,
  useGenerateRuleWithAIMutation,
} = rulesApi;
