import { baseApi } from '../baseApi';
import { auth } from '../../../config/firebase';
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

    getDirectoryRules: builder.query<GetDirectoryRulesResponse, GetDirectoryRulesRequest>({
      query: (data) => ({
        functionName: 'getDirectoryRules',
        data,
      }),
      transformResponse: (response: { 
        success: boolean; 
        rules: Rule[]; 
        inheritanceMap: { [directoryId: string]: Rule[] } 
      }) => {
        return {
          rules: response.rules,
          inheritanceMap: response.inheritanceMap,
        };
      },
      providesTags: (result, error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: arg.directoryId },
      ],
    }),

    getApplicableRules: builder.query<
      GetApplicableRulesWithDefaultsResponse,
      GetApplicableRulesRequest
    >({
      query: (data) => ({
        functionName: 'getApplicableRules',
        data,
      }),
      transformResponse: (response: { 
        success: boolean; 
        rules: Rule[]; 
        defaultRuleIds: string[] 
      }) => {
        return {
          rules: response.rules,
          defaultRuleIds: response.defaultRuleIds,
        };
      },
      providesTags: (result, error, arg) => [
        'DirectoryRules',
        { type: 'DirectoryRules', id: `${arg.directoryId}-${arg.operation}` },
      ],
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
      }),
      transformResponse: (response: {
        success: boolean;
        result: { name: string; description: string; content: string };
      }) => {
        return response.result;
      },
      invalidatesTags: ['Rules'],
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
  useGetDirectoryRulesQuery,
  useGetApplicableRulesQuery,
  useFormatRulesForPromptMutation,
  useGetRuleTagsQuery,
  useGenerateRuleWithAIMutation,
} = rulesApi;
