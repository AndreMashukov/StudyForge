import type { LlmCapability } from '@study-forge/backend-llm/llm/types';

const ESCALATION_REPAIR_THRESHOLD = 2;

export interface DiagramQuizEscalationDetails {
  repairAttemptsByTarget?: Record<string, number>;
  repairEscalated?: boolean;
}

function isValidRepairAttemptCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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
  return {
    repairAttemptsByTarget,
    repairEscalated: raw.repairEscalated === true,
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
  return details.repairEscalated === true;
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
  const repairEscalated =
    current.repairEscalated === true ||
    nextCount >= ESCALATION_REPAIR_THRESHOLD ||
    Object.values(repairAttemptsByTarget).some(
      (count) => count >= ESCALATION_REPAIR_THRESHOLD,
    );

  artifactDetails.repairAttemptsByTarget = repairAttemptsByTarget;
  artifactDetails.repairEscalated = repairEscalated;

  return {
    repairAttemptsByTarget,
    repairEscalated,
  };
}
