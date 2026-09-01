import { DEFAULT_USAGE_CREDIT_COSTS } from '@shared-types';

export const AGENT_GENERATION_LIMITS = {
  maxCredits: 100,
  maxDocuments: 10,
  maxQuizzes: 10,
  maxFlashcardSets: 10,
  maxSourceDocumentsPerFlashcardSet: 5,
} as const;

export interface IAgentGenerationPlanCounts {
  documents: number;
  quizzes: number;
  flashcardSets: number;
}

export interface IAgentGenerationPlanEvaluation {
  counts: IAgentGenerationPlanCounts;
  estimatedCredits: number;
  requiresConfirmation: boolean;
  exceedsHardLimits: boolean;
}

export function estimateGenerationCredits(
  counts: IAgentGenerationPlanCounts,
): number {
  return (
    counts.documents * DEFAULT_USAGE_CREDIT_COSTS.documentFromPrompt +
    counts.quizzes * DEFAULT_USAGE_CREDIT_COSTS.quiz +
    counts.flashcardSets * DEFAULT_USAGE_CREDIT_COSTS.flashcards
  );
}

export function evaluateGenerationPlan(
  counts: IAgentGenerationPlanCounts,
): IAgentGenerationPlanEvaluation {
  const estimatedCredits = estimateGenerationCredits(counts);
  const exceedsHardLimits =
    counts.documents > AGENT_GENERATION_LIMITS.maxDocuments ||
    counts.quizzes > AGENT_GENERATION_LIMITS.maxQuizzes ||
    counts.flashcardSets > AGENT_GENERATION_LIMITS.maxFlashcardSets ||
    estimatedCredits > AGENT_GENERATION_LIMITS.maxCredits;

  return {
    counts,
    estimatedCredits,
    requiresConfirmation: exceedsHardLimits,
    exceedsHardLimits,
  };
}

export function assertGenerationBatchAllowed(
  currentCounts: IAgentGenerationPlanCounts,
  next: Partial<IAgentGenerationPlanCounts>,
): void {
  const merged: IAgentGenerationPlanCounts = {
    documents: currentCounts.documents + (next.documents ?? 0),
    quizzes: currentCounts.quizzes + (next.quizzes ?? 0),
    flashcardSets: currentCounts.flashcardSets + (next.flashcardSets ?? 0),
  };
  const evaluation = evaluateGenerationPlan(merged);
  if (evaluation.exceedsHardLimits) {
    throw new Error(
      `Generation limit exceeded for this turn: max ${AGENT_GENERATION_LIMITS.maxDocuments} documents, ${AGENT_GENERATION_LIMITS.maxQuizzes} quizzes, ${AGENT_GENERATION_LIMITS.maxFlashcardSets} flashcard sets, and ${AGENT_GENERATION_LIMITS.maxCredits} credits. Propose a smaller plan and ask for confirmation before continuing.`,
    );
  }
}

export function formatGenerationEstimate(
  counts: IAgentGenerationPlanCounts,
): string {
  const credits = estimateGenerationCredits(counts);
  const parts: string[] = [];
  if (counts.documents > 0) {
    parts.push(
      `${counts.documents} document${counts.documents === 1 ? '' : 's'} (${DEFAULT_USAGE_CREDIT_COSTS.documentFromPrompt} credits each)`,
    );
  }
  if (counts.quizzes > 0) {
    parts.push(
      `${counts.quizzes} quiz${counts.quizzes === 1 ? '' : 'zes'} (${DEFAULT_USAGE_CREDIT_COSTS.quiz} credits each)`,
    );
  }
  if (counts.flashcardSets > 0) {
    parts.push(
      `${counts.flashcardSets} flashcard set${counts.flashcardSets === 1 ? '' : 's'} (${DEFAULT_USAGE_CREDIT_COSTS.flashcards} credits each)`,
    );
  }
  return `${parts.join(', ')}. Estimated total: ${credits} credits.`;
}
