import type {
  IDocumentAgentJobPayload,
  RuleResolutionMode,
} from '@shared-types';
import { isRuleResolutionMode } from '@study-forge/backend-directories/rule-resolution';

export function resolveDocumentAgentRuleMode(
  payload: Pick<
    IDocumentAgentJobPayload,
    'ruleIds' | 'ruleResolutionMode' | 'sourceKind'
  >,
): RuleResolutionMode {
  if (isRuleResolutionMode(payload.ruleResolutionMode)) {
    return payload.ruleResolutionMode;
  }
  if (payload.ruleIds && payload.ruleIds.length > 0) {
    return 'explicit-only';
  }
  if (payload.sourceKind === 'upload') {
    return 'inherit-plus-explicit';
  }
  return 'inherit';
}
