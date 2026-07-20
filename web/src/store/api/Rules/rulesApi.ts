import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
import {
  resolveApplicableRulesClient,
  resolveDirectoryRulesClient,
} from '../../../services/directoryRulesResolution';
import { fetchRuleFromFirestore, fetchRulesFromFirestore } from '../../../services/rulesFirestore';
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

export const rulesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRules: builder.query<Rule[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        try {
          const rules = await fetchRulesFromFirestore(userId);
          return { data: rules };
        } catch (firestoreError) {
          console.warn('Firestore rules list read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getRules',
            data: {},
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as { success: boolean; rules: Rule[] };
          return { data: response.rules };
        }
      },
      providesTags: ['Rules'],
      keepUnusedDataFor: 300,
    }),

    getRule: builder.query<Rule, string>({
      async queryFn(ruleId, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        try {
          const rule = await fetchRuleFromFirestore(userId, ruleId);
          if (!rule) {
            return {
              error: {
                status: 'CUSTOM_ERROR',
                data: { message: 'Rule not found', code: 'NOT_FOUND' },
              },
            };
          }

          return { data: rule };
        } catch (firestoreError) {
          console.warn('Firestore rule read failed, falling back to callable:', firestoreError);
          const fallback = await baseQuery({
            functionName: 'getRule',
            data: { ruleId },
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as { success: boolean; rule: Rule };
          return { data: response.rule };
        }
      },
      providesTags: (result, error, ruleId) => [
        { type: 'Rules', id: ruleId },
      ],
      keepUnusedDataFor: 300,
    }),

    createRule: builder.mutation<Rule, CreateRuleRequest>({
      query: (data) => ({
        functionName: 'createRule',
        data,
      }),
      transformResponse: (response: { success: boolean; ruleId: string; rule: Rule }) => {
        return response.rule;
      },
      invalidatesTags: ['Rules'],
    }),

    updateRule: builder.mutation<Rule, UpdateRuleRequest>({
      query: (data) => ({
        functionName: 'updateRule',
        data,
      }),
      transformResponse: (response: { success: boolean; rule: Rule }) => {
        return response.rule;
      },
      invalidatesTags: (result, error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
      ],
    }),

    deleteRule: builder.mutation<DeleteRuleResponse, DeleteRuleRequest>({
      query: (data) => ({
        functionName: 'deleteRule',
        data,
      }),
      transformResponse: (response: DeleteRuleResponse) => {
        return response;
      },
      invalidatesTags: (result, error) => 
        result?.success ? ['Rules'] : [],
    }),

    attachRuleToDirectory: builder.mutation<void, AttachRuleToDirectoryRequest>({
      query: (data) => ({
        functionName: 'attachRuleToDirectory',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
        'DirectoryRules',
      ],
    }),

    detachRuleFromDirectory: builder.mutation<void, DetachRuleFromDirectoryRequest>({
      query: (data) => ({
        functionName: 'detachRuleFromDirectory',
        data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Rules', id: arg.ruleId },
        'Rules',
        'DirectoryRules',
      ],
    }),

    bulkDeleteRules: builder.mutation<IBulkOperationResponse, IBulkDeleteRulesRequest>({
      query: (data) => ({
        functionName: 'bulkDeleteRules',
        data,
      }),
      invalidatesTags: (result) =>
        result && result.succeeded > 0 ? ['Rules'] : [],
    }),

    bulkDetachRulesFromDirectory: builder.mutation<
      IBulkOperationResponse,
      IBulkDetachRulesFromDirectoryRequest
    >({
      query: (data) => ({
        functionName: 'bulkDetachRulesFromDirectory',
        data,
      }),
      invalidatesTags: (result) =>
        result && result.succeeded > 0 ? ['Rules', 'DirectoryRules'] : [],
    }),

    getDirectoryRules: builder.query<GetDirectoryRulesResponse, GetDirectoryRulesRequest>({
      async queryFn(data, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!data.directoryId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Directory ID is required' },
            },
          };
        }

        try {
          const resolved = await resolveDirectoryRulesClient(userId, data.directoryId, {
            includeAncestors: data.includeAncestors,
          });
          return { data: resolved };
        } catch (firestoreError) {
          console.warn(
            'Firestore directory rules read failed, falling back to callable:',
            firestoreError,
          );
          const fallback = await baseQuery({
            functionName: 'getDirectoryRules',
            data,
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as {
            success: boolean;
            rules: Rule[];
            inheritanceMap: GetDirectoryRulesResponse['inheritanceMap'];
          };
          return {
            data: {
              rules: response.rules,
              inheritanceMap: response.inheritanceMap,
            },
          };
        }
      },
      providesTags: (result, error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: arg.directoryId },
      ],
      keepUnusedDataFor: 300,
    }),

    getApplicableRules: builder.query<
      GetApplicableRulesWithDefaultsResponse,
      GetApplicableRulesRequest
    >({
      async queryFn(data, _api, _extraOptions, baseQuery) {
        const userId = auth.currentUser?.uid;
        if (!userId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Authentication required' },
            },
          };
        }

        if (!data.directoryId || !data.operation) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              data: { message: 'Directory ID and operation are required' },
            },
          };
        }

        try {
          const resolved = await resolveApplicableRulesClient(
            userId,
            data.directoryId,
            data.operation,
          );
          return { data: resolved };
        } catch (firestoreError) {
          console.warn(
            'Firestore applicable rules read failed, falling back to callable:',
            firestoreError,
          );
          const fallback = await baseQuery({
            functionName: 'getApplicableRules',
            data,
          });
          if (fallback.error) {
            return { error: fallback.error };
          }
          const response = fallback.data as {
            success: boolean;
            rules: Rule[];
            defaultRuleIds: string[];
          };
          return {
            data: {
              rules: response.rules,
              defaultRuleIds: response.defaultRuleIds,
            },
          };
        }
      },
      providesTags: (result, error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: `${arg.directoryId}-${arg.operation}` },
      ],
      keepUnusedDataFor: 300,
    }),

    formatRulesForPrompt: builder.mutation<string, FormatRulesForPromptRequest>({
      query: (data) => ({
        functionName: 'formatRulesForPrompt',
        data,
      }),
      transformResponse: (response: { success: boolean; formattedRules: string }) => {
        return response.formattedRules;
      },
    }),

    getRuleTags: builder.query<string[], void>({
      query: () => ({
        functionName: 'getRuleTags',
        data: {},
      }),
      transformResponse: (response: { success: boolean; tags: string[] }) => {
        return response.tags;
      },
      providesTags: ['Rules'],
    }),

    generateRuleWithAI: builder.mutation<{
      name: string;
      description: string;
      content: string;
    }, {
      topic: string;
      description?: string;
      applicableTo?: string[];
      existingContent?: string;
    }>({
      query: (data) => ({
        functionName: 'generateRuleWithAI',
        data,
        // Server-side timeout is 300s; override the 70s client-side default to match.
        timeout: 300000,
      }),
      transformResponse: (response: {
        success: boolean;
        result: { name: string; description: string; content: string };
      }) => {
        return response.result;
      },
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
