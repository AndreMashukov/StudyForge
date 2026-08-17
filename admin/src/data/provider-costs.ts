import 'server-only';

import type {
  IAdminProviderCostPeriod,
  IProviderCostBucket,
} from '@shared-types';
import { buildUsagePeriodKey } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';

const ADMIN_COST_PERIODS = 'providerCostPeriods';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBucket(value: unknown): IProviderCostBucket {
  if (!isRecord(value)) {
    return { knownCostUsd: 0, eventCount: 0, committedCredits: 0 };
  }

  const knownCostUsd =
    typeof value.knownCostUsd === 'number' ? value.knownCostUsd : 0;
  const eventCount = typeof value.eventCount === 'number' ? value.eventCount : 0;
  const committedCredits =
    typeof value.committedCredits === 'number' ? value.committedCredits : 0;
  const costUsdPerCredit =
    typeof value.costUsdPerCredit === 'number' ? value.costUsdPerCredit : undefined;

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

function parseAdminProviderCostPeriod(
  periodKey: string,
  data: FirebaseFirestore.DocumentData,
): IAdminProviderCostPeriod {
  const knownCostUsd =
    typeof data.knownCostUsd === 'number' ? data.knownCostUsd : 0;
  const unknownCostEventCount =
    typeof data.unknownCostEventCount === 'number'
      ? data.unknownCostEventCount
      : 0;
  const totalEventCount =
    typeof data.totalEventCount === 'number' ? data.totalEventCount : 0;
  const committedCredits =
    typeof data.committedCredits === 'number' ? data.committedCredits : 0;
  const costUsdPerCommittedCredit =
    typeof data.costUsdPerCommittedCredit === 'number'
      ? data.costUsdPerCommittedCredit
      : committedCredits > 0
        ? knownCostUsd / committedCredits
        : undefined;

  return {
    periodKey,
    knownCostUsd,
    unknownCostEventCount,
    totalEventCount,
    committedCredits,
    costUsdPerCommittedCredit,
    byProvider: parseBucketMap(data.byProvider),
    byModel: parseBucketMap(data.byModel),
    byGenerationKind: parseBucketMap(data.byGenerationKind),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

export async function readAdminProviderCostPeriod(
  periodKey: string = buildUsagePeriodKey(),
): Promise<IAdminProviderCostPeriod | null> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(ADMIN_COST_PERIODS)
    .doc(periodKey)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return parseAdminProviderCostPeriod(periodKey, snapshot.data() ?? {});
}

export async function listRecentAdminProviderCostPeriodKeys(
  limit = 12,
): Promise<string[]> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(ADMIN_COST_PERIODS)
    .orderBy('periodKey', 'desc')
    .limit(limit)
    .get();

  if (snapshot.empty) {
    return [buildUsagePeriodKey()];
  }

  return snapshot.docs.map((doc) => doc.id);
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
