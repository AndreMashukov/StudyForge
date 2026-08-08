import type {
  GenerationKind,
  IUsageFeatureAvailability,
  IUserUsageSummary,
} from '@shared-types';
import type { DocumentData } from 'firebase/firestore';
import { fetchUserDoc } from './firestoreReadUtils';

export const USAGE_SUMMARY_COLLECTION = 'usageSummary';
export const USAGE_SUMMARY_DOC_ID = 'current';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    });
  }

  return entries;
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

  return {
    periodKey,
    allowance,
    reservedCredits,
    spentCredits,
    refundedCredits,
    remainingCredits,
    resetAt,
    usageLimitsSetupId,
    usageLimitsSetupName:
      typeof raw.usageLimitsSetupName === 'string' ? raw.usageLimitsSetupName : undefined,
    featureAvailability,
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
