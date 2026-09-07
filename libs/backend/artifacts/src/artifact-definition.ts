import type {
  ArtifactKind,
  IArtifactAgentDiagnostics,
  IArtifactCriticResult,
  RuleResolutionMode,
} from '@shared-types';
import type { LlmCapability } from '@study-forge/backend-llm/llm/types';

export interface ArtifactAgentDefinition<TDraft, TPayload = unknown> {
  artifactKind: ArtifactKind;
  displayName: string;
  collection:
    | 'diagramQuizzes'
    | 'slideDecks'
    | 'sequenceQuizzes'
    | 'flashcards';
  primaryCapability: LlmCapability;
  helperCapability?: LlmCapability;
  agentDefinitionVersion: string;
  warningsBlockCompletion?: boolean;

  loadContext(
    input: ArtifactAgentDefinitionInput<TPayload>
  ): Promise<ArtifactAgentContext>;
  generate(
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<TDraft>;
  gates: ArtifactGate<TDraft>[];
  repair?: ArtifactRepairStrategy<TDraft>;
  critic?: ArtifactCriticStrategy<TDraft>;
  refiner?: ArtifactRefinerStrategy<TDraft>;
  persistCompleted(result: ArtifactAgentResult<TDraft>): Promise<void>;
  markFailed(result: ArtifactAgentFailure): Promise<void>;

  limits: {
    maxRepairIterations: number;
    maxCriticIterations: number;
    timeoutSeconds: number;
  };
}

export interface ArtifactAgentDefinitionInput<TPayload = unknown> {
  userId: string;
  directoryId: string;
  recordId: string;
  jobId: string;
  artifactKind: ArtifactKind;
  payload: ArtifactAgentDefinitionPayload<TPayload>;
}

export interface ArtifactAgentDefinitionPayload<TArtifactPayload = unknown> {
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

export interface ArtifactAgentContext {
  userId: string;
  directoryId: string;
  recordId: string;
  jobId: string;
  artifactKind: ArtifactKind;
  documentIds: string[];
  title: string;
  enhancedPrompt: string;
  appliedRuleIds: string[];
  followupRuleIds: string[];
  sourceContent: {
    title: string;
    content: string;
    wordCount: number;
  };
  extras?: Record<string, unknown>;
}

export interface ArtifactGateFailure {
  gateId: string;
  severity: 'warning' | 'blocker';
  message: string;
  path?: string;
  repairTarget?: {
    questionIndex?: number;
    diagramIndex?: number;
  };
}

export interface ArtifactGateResult {
  passed: boolean;
  failures: ArtifactGateFailure[];
}

export interface ArtifactAgentResult<TDraft> {
  context: ArtifactAgentContext;
  draft: TDraft;
  diagnostics: IArtifactAgentDiagnostics;
  generationModel?: string;
  agentModel?: string;
}

export interface ArtifactAgentFailure {
  context: ArtifactAgentContext;
  diagnostics: IArtifactAgentDiagnostics;
  message: string;
}

export interface ArtifactRepairStrategy<TDraft> {
  repair(
    draft: TDraft,
    failures: ArtifactGateFailure[],
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<TDraft>;
}

export interface ArtifactCriticStrategy<TDraft> {
  criticize(
    draft: TDraft,
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<IArtifactCriticResult>;
}

export interface ArtifactRefinerStrategy<TDraft> {
  refine(
    draft: TDraft,
    criticResult: IArtifactCriticResult,
    context: ArtifactAgentContext,
    diagnostics: IArtifactAgentDiagnostics
  ): Promise<TDraft>;
}

export interface ArtifactGate<TDraft> {
  id: string;
  run(
    draft: TDraft,
    context: ArtifactAgentContext
  ): Promise<ArtifactGateFailure[]>;
}
