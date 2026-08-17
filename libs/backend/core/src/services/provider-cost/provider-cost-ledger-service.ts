import {
  calculateProviderCostUsd,
  type GenerationKind,
  type IProviderCostBucket,
  type IProviderUsageUnits,
  type IRecordProviderCallParams,
  type LlmModality,
  type ProviderCostCallStatus,
} from '@shared-types';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import {
  getProviderCostContext,
  nextProviderCallSequence,
} from './provider-cost-context';
import { resolveProviderRateSnapshot } from './provider-rate-catalog';

const USERS_COLLECTION = 'users';

interface IIncrementCostRollupsParams {
  userId: string;
  periodKey: string;
  costUsd: number;
  providerKind: string;
  model: string;
  generationKind?: GenerationKind;
  now: string;
}

interface IIncrementUnknownRollupsParams {
  userId: string;
  periodKey: string;
  now: string;
}

interface ISyncCommittedCreditsParams {
  userId: string;
  periodKey: string;
  committedCredits: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function llmUsageEventsCollection(userId: string) {
  return getFirestore().collection(USERS_COLLECTION).doc(userId).collection('llmUsageEvents');
}

function userProviderCostPeriodRef(userId: string, periodKey: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('providerCostPeriods')
    .doc(periodKey);
}

function emptyBucket(): IProviderCostBucket {
  return {
    knownCostUsd: 0,
    eventCount: 0,
    committedCredits: 0,
  };
}

function parseBucket(value: unknown): IProviderCostBucket {
  if (!isRecord(value)) {
    return emptyBucket();
  }

  const bucket: IProviderCostBucket = {
    knownCostUsd:
      typeof value.knownCostUsd === 'number' && Number.isFinite(value.knownCostUsd)
        ? value.knownCostUsd
        : 0,
    eventCount:
      typeof value.eventCount === 'number' && Number.isFinite(value.eventCount)
        ? value.eventCount
        : 0,
    committedCredits:
      typeof value.committedCredits === 'number' && Number.isFinite(value.committedCredits)
        ? value.committedCredits
        : 0,
  };
  if (typeof value.costUsdPerCredit === 'number' && Number.isFinite(value.costUsdPerCredit)) {
    bucket.costUsdPerCredit = value.costUsdPerCredit;
  }
  return bucket;
}

function readBucketMap(value: unknown): Record<string, IProviderCostBucket> {
  if (!isRecord(value)) {
    return {};
  }

  const buckets: Record<string, IProviderCostBucket> = {};
  for (const [key, bucketValue] of Object.entries(value)) {
    buckets[key] = parseBucket(bucketValue);
  }
  return buckets;
}

function incrementBucket(
  buckets: Record<string, IProviderCostBucket>,
  key: string,
  costUsd: number,
): Record<string, IProviderCostBucket> {
  const current = buckets[key] ?? emptyBucket();
  return {
    ...buckets,
    [key]: {
      ...current,
      knownCostUsd: current.knownCostUsd + costUsd,
      eventCount: current.eventCount + 1,
    },
  };
}

function omitUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }
    if (entry instanceof FieldValue) {
      result[key] = entry;
      continue;
    }
    if (isRecord(entry) && !Array.isArray(entry)) {
      result[key] = omitUndefined(entry);
      continue;
    }
    result[key] = entry;
  }
  return result;
}

function mapFinishReasonToStatus(finishReason?: string): ProviderCostCallStatus {
  if (!finishReason) {
    return 'ok';
  }
  if (finishReason === 'length') {
    return 'truncated';
  }
  return 'ok';
}

export async function recordProviderCall(
  params: IRecordProviderCallParams,
): Promise<void> {
  const baseContext = getProviderCostContext();
  const context = {
    ...baseContext,
    ...params.contextOverride,
  };

  if (!context?.userId) {
    return;
  }

  const usage: IProviderUsageUnits = params.usage ?? {};
  const rateSnapshot = await resolveProviderRateSnapshot({
    providerKind: params.providerKind,
    model: params.model,
    units: usage,
  });

  const costUsd =
    rateSnapshot !== null ? calculateProviderCostUsd({ units: usage, rate: rateSnapshot }) : null;
  const costKnown = costUsd !== null;
  const now = new Date().toISOString();
  const callSequence = nextProviderCallSequence();
  const status =
    params.status === 'ok' && params.finishReason
      ? mapFinishReasonToStatus(params.finishReason)
      : params.status;

  const eventRef = llmUsageEventsCollection(context.userId).doc();
  const eventDoc = omitUndefined({
    id: eventRef.id,
    userId: context.userId,
    periodKey: context.periodKey,
    generationKind: context.generationKind,
    reservationId: context.reservationId,
    jobId: context.jobId,
    recordId: context.recordId,
    threadId: context.threadId,
    llmSetupId: context.llmSetupId,
    userGroupId: context.userGroupId,
    providerKind: params.providerKind,
    connectionId: params.connectionId,
    model: params.model,
    modality: params.modality,
    workflow: params.workflow ?? context.workflow,
    callRole: params.callRole ?? context.callRole ?? 'generation',
    callSequence,
    usage,
    rateSnapshot: rateSnapshot ?? undefined,
    costUsd: costKnown ? costUsd : undefined,
    costKnown,
    costSource: costKnown ? ('provider_usage_estimate' as const) : ('unknown' as const),
    status,
    finishReason: params.finishReason,
    attempt: params.attempt ?? 1,
    durationMs: params.durationMs,
    createdAt: now,
  });

  try {
    await eventRef.set(eventDoc);

    if (costKnown && costUsd !== null) {
      await incrementCostRollups({
        userId: context.userId,
        periodKey: context.periodKey,
        costUsd,
        providerKind: params.providerKind,
        model: params.model,
        generationKind: context.generationKind,
        now,
      });
    } else {
      await incrementUnknownRollups({
        userId: context.userId,
        periodKey: context.periodKey,
        now,
      });
    }

    functions.logger.debug('Recorded provider call', {
      eventId: eventRef.id,
      userId: context.userId,
      model: params.model,
      costKnown,
      costUsd,
    });
  } catch (error) {
    functions.logger.warn('Failed to record provider call', {
      userId: context.userId,
      model: params.model,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function incrementCostRollups(params: IIncrementCostRollupsParams): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);

  await getFirestore().runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() ?? {};

    const userByProvider = incrementBucket(
      readBucketMap(userData.byProvider),
      params.providerKind,
      params.costUsd,
    );
    const userByModel = incrementBucket(
      readBucketMap(userData.byModel),
      params.model,
      params.costUsd,
    );
    const userByKind = params.generationKind
      ? incrementBucket(
          readBucketMap(userData.byGenerationKind),
          params.generationKind,
          params.costUsd,
        )
      : readBucketMap(userData.byGenerationKind);

    transaction.set(
      userRef,
      omitUndefined({
        periodKey: params.periodKey,
        userId: params.userId,
        knownCostUsd: FieldValue.increment(params.costUsd),
        totalEventCount: FieldValue.increment(1),
        byProvider: userByProvider,
        byModel: userByModel,
        byGenerationKind: userByKind,
        updatedAt: params.now,
      }),
      { merge: true },
    );
  });
}

async function incrementUnknownRollups(
  params: IIncrementUnknownRollupsParams,
): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);

  await userRef.set(
    {
      periodKey: params.periodKey,
      userId: params.userId,
      unknownCostEventCount: FieldValue.increment(1),
      totalEventCount: FieldValue.increment(1),
      updatedAt: params.now,
    },
    { merge: true },
  );
}

/** Sync committed credits from usagePeriods into the user cost rollup. */
export async function syncCommittedCreditsToProviderCostRollups(
  params: ISyncCommittedCreditsParams,
): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);
  const snap = await userRef.get();
  const knownCostUsd =
    typeof snap.data()?.knownCostUsd === 'number' ? snap.data()?.knownCostUsd : 0;
  const costUsdPerCommittedCredit =
    params.committedCredits > 0 ? knownCostUsd / params.committedCredits : undefined;

  await userRef.set(
    omitUndefined({
      committedCredits: params.committedCredits,
      costUsdPerCommittedCredit,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

export async function recordProviderCallSafe(
  params: IRecordProviderCallParams,
): Promise<void> {
  try {
    await recordProviderCall(params);
  } catch (error) {
    functions.logger.warn('Provider cost tracking failed', {
      model: params.model,
      providerKind: params.providerKind,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function modalityFromCall(params: {
  modality?: LlmModality;
  defaultModality?: LlmModality;
}): LlmModality {
  return params.modality ?? params.defaultModality ?? 'text';
}
