import type {
  ArtifactKind,
  IArtifactAgentDiagnostics,
  IArtifactCriticResult,
  LlmCapabilityKey,
  RuleResolutionMode,
} from '@shared-types';
import type { LlmCapability } from '../llm/types';

export interface ArtifactAgentJobInput<TPayload = unknown> {
  userId: string;
  directoryId: string;
  recordId: string;
  jobId: string;
  artifactKind: ArtifactKind;
  payload: ArtifactAgentJobPayload<TPayload>;
}

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
  /** Optional artifact-specific values carried from loadContext into generate/persist. */
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
  run(draft: TDraft, context: ArtifactAgentContext): Promise<ArtifactGateFailure[]>;
}

export interface ArtifactAgentDefinition<TDraft, TPayload = unknown> {
  artifactKind: ArtifactKind;
  displayName: string;
  collection:
    | 'diagramQuizzes'
    | 'slideDecks'
    | 'sequenceQuizzes'
    | 'flashcards'
    | 'subjectWorlds';
  primaryCapability: LlmCapability;
  helperCapability?: LlmCapability;
  agentDefinitionVersion: string;
  warningsBlockCompletion?: boolean;

  loadContext(input: ArtifactAgentJobInput<TPayload>): Promise<ArtifactAgentContext>;
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

export function createEmptyDiagnostics(
  definition: Pick<ArtifactAgentDefinition<unknown>, 'artifactKind' | 'agentDefinitionVersion'>
): IArtifactAgentDiagnostics {
  return {
    artifactKind: definition.artifactKind,
    agentDefinitionVersion: definition.agentDefinitionVersion,
    orchestrationMode: 'adk-runner',
    generatorAttempts: 0,
    repairCount: 0,
    criticCycles: 0,
    modelUsage: [],
    residuals: [],
  };
}

export function recordModelUsage(
  diagnostics: IArtifactAgentDiagnostics,
  entry: {
    role: 'generator' | 'repair' | 'critic' | 'refiner';
    capability: LlmCapabilityKey;
    model?: string;
    durationMs?: number;
  }
): void {
  diagnostics.modelUsage.push(entry);
}

export function runArtifactGates<TDraft>(
  gates: ArtifactGate<TDraft>[],
  draft: TDraft,
  context: ArtifactAgentContext
): Promise<ArtifactGateResult> {
  return gates.reduce<Promise<ArtifactGateResult>>(
    async (previousPromise, gate) => {
      const previous = await previousPromise;
      const failures = await gate.run(draft, context);
      return {
        passed: previous.passed && failures.every((failure) => failure.severity !== 'blocker'),
        failures: [...previous.failures, ...failures],
      };
    },
    Promise.resolve({ passed: true, failures: [] })
  );
}

export function hasBlockerFailures(failures: ArtifactGateFailure[]): boolean {
  return failures.some((failure) => failure.severity === 'blocker');
}

export function mergeFailuresIntoDiagnostics(
  diagnostics: IArtifactAgentDiagnostics,
  failures: ArtifactGateFailure[]
): void {
  for (const failure of failures) {
    diagnostics.residuals.push({
      gateId: failure.gateId,
      severity: failure.severity,
      message: failure.message,
      ...(failure.path !== undefined ? { path: failure.path } : {}),
    });
  }
}
