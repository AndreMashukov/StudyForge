import type {
  ArtifactKind,
  IArtifactAgentDiagnostics,
  IArtifactCriticResult,
  LlmCapabilityKey,
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


// ---------------------------------------------------------------------------
// Runtime helpers relocated from `artifact-agent/artifact-agent-definition.ts`.
// Phase D of the flashcards migration retired the legacy ADK tree; these
// helpers belong to the canonical symbol set used by both flashcards and
// diagram-quiz paths.
// ---------------------------------------------------------------------------

/**
 * Build the initial IArtifactAgentDiagnostics shape used at runner seed
 * time. Mirrors the ADK factory's seed: kind, definition version,
 * orchestrationMode tag, and empty attempt / usage counters.
 */
export function createEmptyDiagnostics(
  definition: Pick<ArtifactAgentDefinition<unknown>, 'artifactKind' | 'agentDefinitionVersion'>
): IArtifactAgentDiagnostics {
  return {
    artifactKind: definition.artifactKind,
    agentDefinitionVersion: definition.agentDefinitionVersion,
    orchestrationMode: 'langgraph-runner',
    generatorAttempts: 0,
    repairCount: 0,
    criticCycles: 0,
    modelUsage: [],
    residuals: [],
  };
}

/**
 * Record a model-usage entry on the live diagnostics. The "langgraph-runner"
 * orchestration tag in `createEmptyDiagnostics` is what distinguishes these
 * entries from the legacy ADK runner's seed.
 */
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

/**
 * Run a definition's gate list sequentially, accumulating failures and
 * propagating a single blocker-free pass/fail result. Equivalent to the
 * ADK factory's gate runner; preserved verbatim from the retired tree.
 */
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
    Promise.resolve({ passed: true, failures: [] as ArtifactGateFailure[] })
  );
}

/**
 * Return true when at least one of the supplied gate failures has
 * severity `blocker`. Used by graph nodes and finalize to decide whether
 * a draft is still a candidate or whether the loop should route to
 * markFailed.
 */
export function hasBlockerFailures(failures: ArtifactGateFailure[]): boolean {
  return failures.some((failure) => failure.severity === 'blocker');
}

// Re-exports: co-located relocation targets (Phase A). Kept on this module
// so callers can keep importing `from '@study-forge/backend-artifacts/artifact-definition'`
// while the dispatcher and downstream consumers migrate to direct imports.
export type {
  ArtifactAgentJobInput,
  ArtifactAgentJobPayload,
} from './artifact-job-input';
export { ArtifactAgentPipelineFailedError } from './artifact-errors';
export {
  isArtifactKind,
  recordRefForArtifactKind,
} from './artifact-record-paths';
