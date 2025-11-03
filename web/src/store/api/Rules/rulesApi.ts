import { baseApi } from '../baseApi';
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
  RuleApplicability,
} from '@shared-types';
import { GetApplicableRulesWithDefaultsResponse } from './IRulesApi';

export const rulesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all rules for the authenticated user
     */
    getRules: builder.query<Rule[], void>({
      query: () => ({
        functionName: 'getRules',
        data: {},
      }),
      transformResponse: (response: { success: boolean; rules: Rule[] }) => {
        return response.rules;
      },
      providesTags: ['Rules'],
    }),

    /**
     * Get a single rule by ID
     */
    getRule: builder.query<Rule, string>({
      query: (ruleId) => ({
        functionName: 'getRule',
        data: { ruleId },
      }),
      transformResponse: (response: { success: boolean; rule: Rule }) => {
        return response.rule;
      },
      providesTags: (result, error, ruleId) => [
        { type: 'Rules', id: ruleId },
      ],
    }),

    /**
     * Create a new rule
     */
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

    /**
     * Update an existing rule
     */
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

    /**
     * Delete a rule (only if not attached to directories)
     */
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

    /**
     * Attach a rule to a directory
     */
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

    /**
     * Detach a rule from a directory
     */
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

    /**
     * Get rules for a directory (with optional cascading)
     */
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

    /**
     * Get applicable rules for a specific operation in a directory
     * Returns rules filtered by operation type with defaults pre-selected
     */
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

    /**
     * Format selected rules for AI prompt injection
     */
    formatRulesForPrompt: builder.mutation<string, FormatRulesForPromptRequest>({
      query: (data) => ({
        functionName: 'formatRulesForPrompt',
        data,
      }),
      transformResponse: (response: { success: boolean; formattedRules: string }) => {
        return response.formattedRules;
      },
    }),

    /**
     * Get all unique tags used by user's rules
     */
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
} = rulesApi;
