import type {
  IArtifactAgentDiagnostics,
  IArtifactCriticResult,
} from '@shared-types';
import type { LlmCapability } from '@study-forge/backend-llm/llm/types';

const ESCALATION_REPAIR_THRESHOLD = 2;
/** After this many completed critic passes, use escalation when the last verdict is not pass. */
const CRITIC_LOOP_ESCALATION_THRESHOLD = 2;

export interface DiagramQuizEscalationDetails {
  repairAttemptsByTarget?: Record<string, number>;
  criticLoopEscalate?: boolean;
  criticCompletedIterations?: number;
  criticLastVerdict?: IArtifactCriticResult['overallVerdict'];
}

function isValidRepairAttemptCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCriticVerdict(
  value: unknown,
): value is IArtifactCriticResult['overallVerdict'] {
  return value === 'pass' || value === 'revise' || value === 'fail';
}

export function diagramQuizRepairTargetKey(
  questionIndex: number,
  diagramIndex?: number,
): string {
  if (diagramIndex === undefined) {
    return `q${questionIndex}:rebalance`;
  }
  return `q${questionIndex}:d${diagramIndex}`;
}

export function readDiagramQuizEscalationDetails(
  artifactDetails: Record<string, unknown> | undefined,
): DiagramQuizEscalationDetails {
  const raw = artifactDetails ?? {};
  const attempts = raw.repairAttemptsByTarget;
  const repairAttemptsByTarget: Record<string, number> | undefined =
    attempts && typeof attempts === 'object' && !Array.isArray(attempts)
      ? Object.fromEntries(
          Object.entries(attempts).filter((entry): entry is [string, number] =>
            isValidRepairAttemptCount(entry[1]),
          ),
        )
      : undefined;
  const criticLastVerdict = isCriticVerdict(raw.criticLastVerdict)
    ? raw.criticLastVerdict
    : undefined;
  const criticCompletedIterations = isValidRepairAttemptCount(
    raw.criticCompletedIterations,
  )
    ? raw.criticCompletedIterations
    : undefined;
  return {
    repairAttemptsByTarget,
    criticLoopEscalate: raw.criticLoopEscalate === true,
    criticCompletedIterations,
    criticLastVerdict,
  };
}

export function repairAttemptCount(
  details: DiagramQuizEscalationDetails,
  targetKey: string,
): number {
  return details.repairAttemptsByTarget?.[targetKey] ?? 0;
}

export function shouldUseEscalationForRepair(
  details: DiagramQuizEscalationDetails,
  targetKey: string,
): boolean {
  return repairAttemptCount(details, targetKey) >= ESCALATION_REPAIR_THRESHOLD;
}

export function shouldUseEscalationForCriticOrRefiner(
  details: DiagramQuizEscalationDetails,
): boolean {
  return details.criticLoopEscalate === true;
}

export function resolveDiagramQuizAgentRouteCapability(
  details: DiagramQuizEscalationDetails,
  targetKey: string,
): Extract<LlmCapability, 'diagramQuizAgent' | 'escalation'> {
  if (shouldUseEscalationForRepair(details, targetKey)) {
    return 'escalation';
  }
  return 'diagramQuizAgent';
}

export function resolveDiagramQuizRefineRouteCapability(
  details: DiagramQuizEscalationDetails,
): Extract<LlmCapability, 'diagramQuiz' | 'escalation'> {
  if (shouldUseEscalationForCriticOrRefiner(details)) {
    return 'escalation';
  }
  return 'diagramQuiz';
}

export function recordCriticLoopEscalationSignal(
  diagnostics: IArtifactAgentDiagnostics,
  params: {
    completedCriticIterations: number;
    lastVerdict: IArtifactCriticResult['overallVerdict'] | undefined;
  },
): DiagramQuizEscalationDetails {
  const artifactDetails = diagnostics.artifactDetails ?? {};
  diagnostics.artifactDetails = artifactDetails;

  const criticLoopEscalate =
    params.completedCriticIterations >= CRITIC_LOOP_ESCALATION_THRESHOLD &&
    params.lastVerdict !== undefined &&
    params.lastVerdict !== 'pass';

  artifactDetails.criticLoopEscalate = criticLoopEscalate;
  artifactDetails.criticCompletedIterations = params.completedCriticIterations;
  if (params.lastVerdict !== undefined) {
    artifactDetails.criticLastVerdict = params.lastVerdict;
  }

  return readDiagramQuizEscalationDetails(artifactDetails);
}

export function recordDiagramQuizRepairAttempt(
  artifactDetails: Record<string, unknown>,
  targetKey: string,
): DiagramQuizEscalationDetails {
  const current = readDiagramQuizEscalationDetails(artifactDetails);
  const nextCount = repairAttemptCount(current, targetKey) + 1;
  const repairAttemptsByTarget = {
    ...(current.repairAttemptsByTarget ?? {}),
    [targetKey]: nextCount,
  };

  artifactDetails.repairAttemptsByTarget = repairAttemptsByTarget;

  return {
    ...readDiagramQuizEscalationDetails(artifactDetails),
    repairAttemptsByTarget,
  };
}
