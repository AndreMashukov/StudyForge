import type { GenerationKind } from '@shared-types';
import {
  calculateRemainingCredits,
  calculateUsageCreditCharge,
  type IUsageFeaturePolicy,
} from '@shared-types';

export interface IUsagePeriodState {
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
}

export type UsageLimitDecision =
  | {
      allowed: true;
      credits: number;
    }
  | {
      allowed: false;
      code: 'FEATURE_DISABLED' | 'INSUFFICIENT_CREDITS';
      message: string;
      credits: number;
      remainingCredits: number;
    };

export function evaluateUsageLimitDecision(params: {
  policy: IUsageFeaturePolicy;
  period: IUsagePeriodState;
  quantity?: number;
}): UsageLimitDecision {
  const credits = calculateUsageCreditCharge(params.policy, params.quantity);

  if (!params.policy.enabled) {
    return {
      allowed: false,
      code: 'FEATURE_DISABLED',
      message: 'This feature is not available on your current plan.',
      credits,
      remainingCredits: calculateRemainingCredits(params.period),
    };
  }

  const remainingCredits = calculateRemainingCredits(params.period);
  if (remainingCredits < credits) {
    return {
      allowed: false,
      code: 'INSUFFICIENT_CREDITS',
      message: 'You do not have enough credits for this action.',
      credits,
      remainingCredits,
    };
  }

  return {
    allowed: true,
    credits,
  };
}

export function resolveUsageGenerationKind(kind: string): GenerationKind {
  if (kind === 'slideDeck') {
    return 'slideDeckText';
  }

  if (kind === 'artifactAgent') {
    return 'diagramQuiz';
  }

  if (kind === 'directoryAgent') {
    return 'directoryChat';
  }

  return kind as GenerationKind;
}

export function mapJobKindToUsageGenerationKind(
  jobKind: string,
  artifactKind?: string
): GenerationKind {
  if (jobKind === 'artifactAgent') {
    if (artifactKind === 'flashcards') {
      return 'flashcards';
    }
    return 'diagramQuiz';
  }

  return resolveUsageGenerationKind(jobKind);
}
