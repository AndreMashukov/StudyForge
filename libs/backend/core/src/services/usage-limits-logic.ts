import type { GenerationKind } from '@shared-types';
import {
  calculateOverageAmountCents,
  calculateRemainingCredits,
  calculateRemainingOverageCapCents,
  calculateUsageCreditCharge,
  type IUsageFeaturePolicy,
} from '@shared-types';

export interface IUsagePeriodState {
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
  reservedOverageCredits?: number;
  spentOverageCredits?: number;
  overageAmountCents?: number;
  reservedOverageAmountCents?: number;
}

export interface IUsageBillingContext {
  payAsYouGoEnabled: boolean;
  hasPaymentMethod: boolean;
  monthlyCapCents: number;
  pricePerCreditCents: number;
  overageAmountCents: number;
  reservedOverageAmountCents: number;
}

export type UsageLimitDecision =
  | {
      allowed: true;
      credits: number;
      includedCredits: number;
      overageCredits: number;
      overageAmountCents: number;
    }
  | {
      allowed: false;
      code:
        | 'FEATURE_DISABLED'
        | 'INSUFFICIENT_CREDITS'
        | 'PAY_AS_YOU_GO_DISABLED'
        | 'PAYMENT_METHOD_REQUIRED'
        | 'OVERAGE_CAP_EXCEEDED';
      message: string;
      credits: number;
      remainingCredits: number;
    };

export function evaluateUsageLimitDecision(params: {
  policy: IUsageFeaturePolicy;
  period: IUsagePeriodState;
  billing?: IUsageBillingContext;
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

  const remainingIncluded = calculateRemainingCredits(params.period);

  if (remainingIncluded >= credits) {
    return {
      allowed: true,
      credits,
      includedCredits: credits,
      overageCredits: 0,
      overageAmountCents: 0,
    };
  }

  const includedCredits = Math.max(0, remainingIncluded);
  const overageCredits = credits - includedCredits;

  if (!params.billing?.payAsYouGoEnabled) {
    return {
      allowed: false,
      code: 'INSUFFICIENT_CREDITS',
      message: 'You do not have enough credits for this action.',
      credits,
      remainingCredits: remainingIncluded,
    };
  }

  if (!params.billing.hasPaymentMethod) {
    return {
      allowed: false,
      code: 'PAYMENT_METHOD_REQUIRED',
      message: 'Add a payment method to continue with pay-as-you-go.',
      credits,
      remainingCredits: remainingIncluded,
    };
  }

  const overageAmountCents = calculateOverageAmountCents(
    overageCredits,
    params.billing.pricePerCreditCents,
  );
  const remainingCapCents = calculateRemainingOverageCapCents({
    monthlyCapCents: params.billing.monthlyCapCents,
    overageAmountCents: params.billing.overageAmountCents,
    reservedOverageAmountCents: params.billing.reservedOverageAmountCents,
  });

  if (overageAmountCents > remainingCapCents) {
    return {
      allowed: false,
      code: 'OVERAGE_CAP_EXCEEDED',
      message: 'This action would exceed your monthly pay-as-you-go spending cap.',
      credits,
      remainingCredits: remainingIncluded,
    };
  }

  return {
    allowed: true,
    credits,
    includedCredits,
    overageCredits,
    overageAmountCents,
  };
}

export function evaluateFeatureAffordability(params: {
  policy: IUsageFeaturePolicy;
  remainingIncluded: number;
  billing?: IUsageBillingContext;
}): { affordable: boolean; usesOverage: boolean } {
  if (!params.policy.enabled) {
    return { affordable: false, usesOverage: false };
  }

  const cost = params.policy.creditCost;
  if (params.remainingIncluded >= cost) {
    return { affordable: true, usesOverage: false };
  }

  if (!params.billing?.payAsYouGoEnabled || !params.billing.hasPaymentMethod) {
    return { affordable: false, usesOverage: false };
  }

  const overageCredits = cost - Math.max(0, params.remainingIncluded);
  const overageAmountCents = calculateOverageAmountCents(
    overageCredits,
    params.billing.pricePerCreditCents,
  );
  const remainingCapCents = calculateRemainingOverageCapCents({
    monthlyCapCents: params.billing.monthlyCapCents,
    overageAmountCents: params.billing.overageAmountCents,
    reservedOverageAmountCents: params.billing.reservedOverageAmountCents,
  });

  if (overageAmountCents <= remainingCapCents) {
    return { affordable: true, usesOverage: true };
  }

  return { affordable: false, usesOverage: false };
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
  artifactKind?: string,
): GenerationKind {
  if (jobKind === 'artifactAgent') {
    if (artifactKind === 'flashcards') {
      return 'flashcards';
    }
    return 'diagramQuiz';
  }

  return resolveUsageGenerationKind(jobKind);
}
