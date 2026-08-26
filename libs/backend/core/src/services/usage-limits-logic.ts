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
      message:
        'This action would exceed your monthly pay-as-you-go spending cap.',
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

export function resolveMaxAffordableQuantity(params: {
  policy: IUsageFeaturePolicy;
  period: IUsagePeriodState;
  billing?: IUsageBillingContext;
  maxCredits: number;
}): number {
  if (!params.policy.enabled) {
    return 0;
  }

  const unitCost = Math.max(1, Math.floor(params.policy.creditCost));
  const maxCredits = Number.isFinite(params.maxCredits)
    ? Math.max(0, Math.floor(params.maxCredits))
    : 0;
  const maxQuantity = Math.floor(maxCredits / unitCost);
  if (maxQuantity < 1) {
    return 0;
  }

  const remainingIncluded = calculateRemainingCredits(params.period);
  const includedQuantity = Math.floor(remainingIncluded / unitCost);
  if (includedQuantity >= maxQuantity) {
    return maxQuantity;
  }

  if (!params.billing?.payAsYouGoEnabled || !params.billing.hasPaymentMethod) {
    return Math.max(0, includedQuantity);
  }

  const remainingCapCents = calculateRemainingOverageCapCents({
    monthlyCapCents: params.billing.monthlyCapCents,
    overageAmountCents: params.billing.overageAmountCents,
    reservedOverageAmountCents: params.billing.reservedOverageAmountCents,
  });
  const overageCreditsAffordable =
    params.billing.pricePerCreditCents > 0
      ? Math.floor(remainingCapCents / params.billing.pricePerCreditCents)
      : 0;
  const totalCredits = remainingIncluded + Math.max(0, overageCreditsAffordable);
  const totalQuantity = Math.floor(totalCredits / unitCost);
  return Math.min(maxQuantity, Math.max(0, totalQuantity));
}

export interface IReservationCommitSplit {
  commitCredits: number;
  commitIncludedCredits: number;
  commitOverageCredits: number;
  commitOverageAmountCents: number;
  unusedIncludedCredits: number;
  unusedOverageCredits: number;
  unusedOverageAmountCents: number;
}

export function splitReservationForCommit(params: {
  reservedCredits: number;
  includedCredits: number;
  overageCredits: number;
  overageAmountCents: number;
  creditsToCommit: number;
}): IReservationCommitSplit {
  const reserved = Math.max(0, params.reservedCredits);
  const included = Math.max(0, params.includedCredits);
  const overage = Math.max(0, params.overageCredits);
  const overageAmount = Math.max(0, params.overageAmountCents);
  const requested = Number.isFinite(params.creditsToCommit)
    ? Math.max(0, Math.floor(params.creditsToCommit))
    : 0;
  const commitCredits = Math.min(reserved, requested);
  const commitIncludedCredits = Math.min(commitCredits, included);
  const commitOverageCredits = commitCredits - commitIncludedCredits;
  const commitOverageAmountCents =
    overage > 0 ? (overageAmount * commitOverageCredits) / overage : 0;

  return {
    commitCredits,
    commitIncludedCredits,
    commitOverageCredits,
    commitOverageAmountCents,
    unusedIncludedCredits: included - commitIncludedCredits,
    unusedOverageCredits: overage - commitOverageCredits,
    unusedOverageAmountCents: overageAmount - commitOverageAmountCents,
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
