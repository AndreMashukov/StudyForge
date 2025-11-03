/**
 * Rules API Type Definitions
 * 
 * These types are used for RTK Query API calls and responses
 * All types are exported from shared-types for consistency
 */

export type {
  Rule,
  RuleApplicability,
  RuleColor,
  CreateRuleRequest,
  UpdateRuleRequest,
  DeleteRuleRequest,
  DeleteRuleResponse,
  AttachRuleToDirectoryRequest,
  DetachRuleFromDirectoryRequest,
  GetDirectoryRulesRequest,
  GetDirectoryRulesResponse,
  GetApplicableRulesRequest,
  GetApplicableRulesResponse,
  FormatRulesForPromptRequest,
  FormatRulesForPromptResponse,
  GetRulesResponse,
  GetRuleResponse,
  CreateRuleResponse,
  UpdateRuleResponse,
  AttachRuleResponse,
  DetachRuleResponse,
} from '@shared-types';

// Additional frontend-specific types
export interface GetApplicableRulesWithDefaultsResponse {
  rules: import('@shared-types').Rule[];
  defaultRuleIds: string[];
}
