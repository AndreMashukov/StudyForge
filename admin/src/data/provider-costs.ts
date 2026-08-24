import 'server-only';

import type {
  IAdminProviderCostPeriod,
  IProviderCostBucket,
} from '@shared-types';
import { buildUsagePeriodKey } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function emptyBucket(): IProviderCostBucket {
  return { knownCostUsd: 0, eventCount: 0, committedCredits: 0 };
}

function parseBucket(value: unknown): IProviderCostBucket {
  if (!isRecord(value)) {
    return emptyBucket();
  }

  const knownCostUsd =
    typeof value.knownCostUsd === 'number' ? value.knownCostUsd : 0;
  const eventCount =
    typeof value.eventCount === 'number' ? value.eventCount : 0;
  const committedCredits =
    typeof value.committedCredits === 'number' ? value.committedCredits : 0;
  const costUsdPerCredit =
    typeof value.costUsdPerCredit === 'number'
      ? value.costUsdPerCredit
      : undefined;

  return {
    knownCostUsd,
    eventCount,
    committedCredits,
    costUsdPerCredit,
  };
}

function parseBucketMap(value: unknown): Record<string, IProviderCostBucket> {
  if (!isRecord(value)) {
    return {};
  }

  const buckets: Record<string, IProviderCostBucket> = {};
  for (const [key, bucketValue] of Object.entries(value)) {
    buckets[key] = parseBucket(bucketValue);
  }
  return buckets;
}

function mergeBuckets(
  target: Record<string, IProviderCostBucket>,
  source: Record<string, IProviderCostBucket>,
): Record<string, IProviderCostBucket> {
  const merged = { ...target };
  for (const [key, bucket] of Object.entries(source)) {
    const current = merged[key] ?? emptyBucket();
    merged[key] = {
      knownCostUsd: current.knownCostUsd + bucket.knownCostUsd,
      eventCount: current.eventCount + bucket.eventCount,
      committedCredits: current.committedCredits + bucket.committedCredits,
    };
  }
  return merged;
}

function isUserPeriodDoc(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): boolean {
  return typeof doc.data().userId === 'string' && doc.data().userId.length > 0;
}

export async function readAdminProviderCostPeriod(
  periodKey: string = buildUsagePeriodKey(),
): Promise<IAdminProviderCostPeriod | null> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collectionGroup('providerCostPeriods')
    .where('periodKey', '==', periodKey)
    .get();

  const userDocs = snapshot.docs.filter(isUserPeriodDoc);
  if (userDocs.length === 0) {
    return null;
  }

  let knownCostUsd = 0;
  let unknownCostEventCount = 0;
  let totalEventCount = 0;
  let committedCredits = 0;
  let updatedAt = '';
  let byProvider: Record<string, IProviderCostBucket> = {};
  let byModel: Record<string, IProviderCostBucket> = {};
  let byGenerationKind: Record<string, IProviderCostBucket> = {};

  for (const doc of userDocs) {
    const data = doc.data();
    knownCostUsd +=
      typeof data.knownCostUsd === 'number' ? data.knownCostUsd : 0;
    unknownCostEventCount +=
      typeof data.unknownCostEventCount === 'number'
        ? data.unknownCostEventCount
        : 0;
    totalEventCount +=
      typeof data.totalEventCount === 'number' ? data.totalEventCount : 0;
    committedCredits +=
      typeof data.committedCredits === 'number' ? data.committedCredits : 0;
    if (typeof data.updatedAt === 'string' && data.updatedAt > updatedAt) {
      updatedAt = data.updatedAt;
    }
    byProvider = mergeBuckets(byProvider, parseBucketMap(data.byProvider));
    byModel = mergeBuckets(byModel, parseBucketMap(data.byModel));
    byGenerationKind = mergeBuckets(
      byGenerationKind,
      parseBucketMap(data.byGenerationKind),
    );
  }

  return {
    periodKey,
    knownCostUsd,
    unknownCostEventCount,
    totalEventCount,
    committedCredits,
    costUsdPerCommittedCredit:
      committedCredits > 0 ? knownCostUsd / committedCredits : undefined,
    byProvider,
    byModel,
    byGenerationKind,
    updatedAt,
  };
}

export function listRecentAdminProviderCostPeriodKeys(limit = 12): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let index = 0; index < limit; index += 1) {
    keys.push(
      buildUsagePeriodKey(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)),
      ),
    );
  }
  return keys;
}

export interface IProviderCostRouteSummary {
  route: string;
  knownCostUsd: number;
  eventCount: number;
  committedCredits: number;
  costUsdPerCredit?: number;
}

export function buildRouteSummaries(
  period: IAdminProviderCostPeriod,
): IProviderCostRouteSummary[] {
  return Object.entries(period.byGenerationKind)
    .map(([route, bucket]) => ({
      route,
      knownCostUsd: bucket.knownCostUsd,
      eventCount: bucket.eventCount,
      committedCredits: bucket.committedCredits,
      costUsdPerCredit:
        bucket.committedCredits > 0
          ? bucket.knownCostUsd / bucket.committedCredits
          : undefined,
    }))
    .sort((left, right) => {
      const leftCost = left.costUsdPerCredit ?? 0;
      const rightCost = right.costUsdPerCredit ?? 0;
      return rightCost - leftCost;
    });
}
