import type { ArtifactKind, RuleResolutionMode } from '@shared-types';

export interface ArtifactAgentJobPayload<TArtifactPayload = unknown> {
  artifactKind: ArtifactKind;
  documentIds: string[];
  directoryId: string;
  recordId: string;
  title?: string;
  additionalPrompt?: string;
  ruleIds?: string[];
  followupRuleIds?: string[];
  additionalRuleIds?: string[];
  ruleResolutionMode?: RuleResolutionMode;
  artifactPayload?: TArtifactPayload;
}

export interface ArtifactAgentJobInput<TPayload = unknown> {
  userId: string;
  directoryId: string;
  recordId: string;
  jobId: string;
  artifactKind: ArtifactKind;
  payload: ArtifactAgentJobPayload<TPayload>;
}
