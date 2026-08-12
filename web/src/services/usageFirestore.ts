import type {
  BillingStatus,
  GenerationKind,
  IUsageDailySlideDeckSummary,
  IUsageFeatureAvailability,
  IUsagePayAsYouGoSummary,
  IUsageStorageSummary,
  IUserUsageSummary,
} from '@shared-types';
import type { DocumentData } from 'firebase/firestore';
import { fetchUserDoc } from './firestoreReadUtils';

export const USAGE_SUMMARY_COLLECTION = 'usageSummary';
export const USAGE_SUMMARY_DOC_ID = 'current';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseBillingStatus(value: unknown): BillingStatus | undefined {
  if (
    value === 'none' ||
    value === 'payment_method_required' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'disabled'
  ) {
    return value;
  }
  return undefined;
}

function parseFeatureAvailability(value: unknown): IUsageFeatureAvailability[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: IUsageFeatureAvailability[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }

    const kind = item.kind;
    const enabled = item.enabled;
    const creditCost = item.creditCost;
    const affordable = item.affordable;

    if (
      typeof kind !== 'string' ||
      typeof enabled !== 'boolean' ||
      typeof creditCost !== 'number' ||
      typeof affordable !== 'boolean'
    ) {
      return null;
    }

    entries.push({
      kind: kind as GenerationKind,
      enabled,
      creditCost,
      affordable,
      ...(typeof item.usesOverage === 'boolean' ? { usesOverage: item.usesOverage } : {}),
    });
  }

  return entries;
}

function parsePayAsYouGoSummary(value: unknown): IUsagePayAsYouGoSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const billingStatus = parseBillingStatus(value.billingStatus);
  const monthlyCapCents = parseOptionalNumber(value.monthlyCapCents);
  const remainingCapCents = parseOptionalNumber(value.remainingCapCents);
  const spentOverageAmountCents = parseOptionalNumber(value.spentOverageAmountCents);
  const reservedOverageAmountCents = parseOptionalNumber(value.reservedOverageAmountCents);
  const spentOverageCredits = parseOptionalNumber(value.spentOverageCredits);
  const reservedOverageCredits = parseOptionalNumber(value.reservedOverageCredits);
  const pricePerCreditCents = parseOptionalNumber(value.pricePerCreditCents);

  if (
    typeof value.enabled !== 'boolean' ||
    typeof value.hasPaymentMethod !== 'boolean' ||
    billingStatus === undefined ||
    monthlyCapCents === undefined ||
    remainingCapCents === undefined ||
    spentOverageAmountCents === undefined ||
    reservedOverageAmountCents === undefined ||
    spentOverageCredits === undefined ||
    reservedOverageCredits === undefined ||
    pricePerCreditCents === undefined
  ) {
    return undefined;
  }

  return {
    enabled: value.enabled,
    monthlyCapCents,
    remainingCapCents,
    spentOverageAmountCents,
    reservedOverageAmountCents,
    spentOverageCredits,
    reservedOverageCredits,
    pricePerCreditCents,
    billingStatus,
    hasPaymentMethod: value.hasPaymentMethod,
  };
}

function parseStorageSummary(value: unknown): IUsageStorageSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const usedBytes = parseOptionalNumber(value.usedBytes);
  const limitBytes = parseOptionalNumber(value.limitBytes);
  const remainingBytes = parseOptionalNumber(value.remainingBytes);

  if (
    usedBytes === undefined ||
    limitBytes === undefined ||
    remainingBytes === undefined
  ) {
    return undefined;
  }

  return { usedBytes, limitBytes, remainingBytes };
}

function parseDailySlideDeckSummary(value: unknown): IUsageDailySlideDeckSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const dayKey = typeof value.dayKey === 'string' ? value.dayKey : '';
  const used = parseOptionalNumber(value.used);
  const limit = parseOptionalNumber(value.limit);
  const remaining = parseOptionalNumber(value.remaining);
  const resetAt = typeof value.resetAt === 'string' ? value.resetAt : '';

  if (!dayKey || used === undefined || limit === undefined || remaining === undefined || !resetAt) {
    return undefined;
  }

  return { dayKey, used, limit, remaining, resetAt };
}

export function parseUsageSummaryFromFirestore(raw: DocumentData): IUserUsageSummary | null {
  const periodKey = typeof raw.periodKey === 'string' ? raw.periodKey : '';
  const allowance = typeof raw.allowance === 'number' ? raw.allowance : NaN;
  const reservedCredits = typeof raw.reservedCredits === 'number' ? raw.reservedCredits : NaN;
  const spentCredits = typeof raw.spentCredits === 'number' ? raw.spentCredits : NaN;
  const refundedCredits = typeof raw.refundedCredits === 'number' ? raw.refundedCredits : NaN;
  const remainingCredits = typeof raw.remainingCredits === 'number' ? raw.remainingCredits : NaN;
  const resetAt = typeof raw.resetAt === 'string' ? raw.resetAt : '';
  const usageLimitsSetupId =
    typeof raw.usageLimitsSetupId === 'string' ? raw.usageLimitsSetupId : '';
  const featureAvailability = parseFeatureAvailability(raw.featureAvailability);

  if (
    !periodKey ||
    !Number.isFinite(allowance) ||
    !Number.isFinite(reservedCredits) ||
    !Number.isFinite(spentCredits) ||
    !Number.isFinite(refundedCredits) ||
    !Number.isFinite(remainingCredits) ||
    !resetAt ||
    !usageLimitsSetupId ||
    !featureAvailability
  ) {
    return null;
  }

  const payAsYouGo = parsePayAsYouGoSummary(raw.payAsYouGo);
  const storage = parseStorageSummary(raw.storage);
  const dailySlideDecks = parseDailySlideDeckSummary(raw.dailySlideDecks);

  return {
    periodKey,
    allowance,
    reservedCredits,
    spentCredits,
    refundedCredits,
    remainingCredits,
    reservedOverageCredits: parseOptionalNumber(raw.reservedOverageCredits),
    spentOverageCredits: parseOptionalNumber(raw.spentOverageCredits),
    overageAmountCents: parseOptionalNumber(raw.overageAmountCents),
    resetAt,
    usageLimitsSetupId,
    usageLimitsSetupName:
      typeof raw.usageLimitsSetupName === 'string' ? raw.usageLimitsSetupName : undefined,
    featureAvailability,
    ...(payAsYouGo ? { payAsYouGo } : {}),
    ...(storage ? { storage } : {}),
    ...(dailySlideDecks ? { dailySlideDecks } : {}),
  };
}

export async function fetchUsageSummaryFromFirestore(
  userId: string,
): Promise<IUserUsageSummary | null> {
  const snapshot = await fetchUserDoc<{ id: string } & IUserUsageSummary>(
    userId,
    USAGE_SUMMARY_COLLECTION,
    USAGE_SUMMARY_DOC_ID,
  );

  if (!snapshot) {
    return null;
  }

  const { id: _id, ...raw } = snapshot;
  return parseUsageSummaryFromFirestore(raw as DocumentData);
}
