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
const ADMIN_COST_PERIODS = 'providerCostPeriods';

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

function adminProviderCostPeriodRef(periodKey: string) {
  return getFirestore().collection(ADMIN_COST_PERIODS).doc(periodKey);
}

function emptyBucket(): IProviderCostBucket {
  return {
    knownCostUsd: 0,
    eventCount: 0,
    committedCredits: 0,
  };
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

  const eventDoc = {
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
  };

  try {
    const eventRef = await llmUsageEventsCollection(context.userId).add(eventDoc);

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
        providerKind: params.providerKind,
        model: params.model,
        generationKind: context.generationKind,
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

async function incrementCostRollups(params: {
  userId: string;
  periodKey: string;
  costUsd: number;
  providerKind: string;
  model: string;
  generationKind?: GenerationKind;
  now: string;
}): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);
  const adminRef = adminProviderCostPeriodRef(params.periodKey);

  await getFirestore().runTransaction(async (transaction) => {
    const [userSnap, adminSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(adminRef),
    ]);

    const userData = userSnap.data() ?? {};
    const adminData = adminSnap.data() ?? {};

    const userByProvider = incrementBucket(
      (userData.byProvider as Record<string, IProviderCostBucket>) ?? {},
      params.providerKind,
      params.costUsd,
    );
    const userByModel = incrementBucket(
      (userData.byModel as Record<string, IProviderCostBucket>) ?? {},
      params.model,
      params.costUsd,
    );
    const userByKind = params.generationKind
      ? incrementBucket(
          (userData.byGenerationKind as Record<string, IProviderCostBucket>) ?? {},
          params.generationKind,
          params.costUsd,
        )
      : ((userData.byGenerationKind as Record<string, IProviderCostBucket>) ?? {});

    const adminByProvider = incrementBucket(
      (adminData.byProvider as Record<string, IProviderCostBucket>) ?? {},
      params.providerKind,
      params.costUsd,
    );
    const adminByModel = incrementBucket(
      (adminData.byModel as Record<string, IProviderCostBucket>) ?? {},
      params.model,
      params.costUsd,
    );
    const adminByKind = params.generationKind
      ? incrementBucket(
          (adminData.byGenerationKind as Record<string, IProviderCostBucket>) ?? {},
          params.generationKind,
          params.costUsd,
        )
      : ((adminData.byGenerationKind as Record<string, IProviderCostBucket>) ?? {});

    transaction.set(
      userRef,
      {
        periodKey: params.periodKey,
        userId: params.userId,
        knownCostUsd: FieldValue.increment(params.costUsd),
        totalEventCount: FieldValue.increment(1),
        byProvider: userByProvider,
        byModel: userByModel,
        byGenerationKind: userByKind,
        updatedAt: params.now,
      },
      { merge: true },
    );

    transaction.set(
      adminRef,
      {
        periodKey: params.periodKey,
        knownCostUsd: FieldValue.increment(params.costUsd),
        totalEventCount: FieldValue.increment(1),
        byProvider: adminByProvider,
        byModel: adminByModel,
        byGenerationKind: adminByKind,
        updatedAt: params.now,
      },
      { merge: true },
    );
  });
}

async function incrementUnknownRollups(params: {
  userId: string;
  periodKey: string;
  providerKind: string;
  model: string;
  generationKind?: GenerationKind;
  now: string;
}): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);
  const adminRef = adminProviderCostPeriodRef(params.periodKey);

  await Promise.all([
    userRef.set(
      {
        periodKey: params.periodKey,
        userId: params.userId,
        unknownCostEventCount: FieldValue.increment(1),
        totalEventCount: FieldValue.increment(1),
        updatedAt: params.now,
      },
      { merge: true },
    ),
    adminRef.set(
      {
        periodKey: params.periodKey,
        unknownCostEventCount: FieldValue.increment(1),
        totalEventCount: FieldValue.increment(1),
        updatedAt: params.now,
      },
      { merge: true },
    ),
  ]);
}

/** Sync committed credits from usagePeriods into cost rollups for cost-per-credit. */
export async function syncCommittedCreditsToProviderCostRollups(params: {
  userId: string;
  periodKey: string;
  committedCredits: number;
}): Promise<void> {
  const userRef = userProviderCostPeriodRef(params.userId, params.periodKey);
  const snap = await userRef.get();
  const knownCostUsd =
    typeof snap.data()?.knownCostUsd === 'number' ? snap.data()?.knownCostUsd : 0;
  const costUsdPerCommittedCredit =
    params.committedCredits > 0 ? knownCostUsd / params.committedCredits : undefined;

  await userRef.set(
    {
      committedCredits: params.committedCredits,
      costUsdPerCommittedCredit,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await recomputeAdminCommittedCredits(params.periodKey);
}

async function recomputeAdminCommittedCredits(periodKey: string): Promise<void> {
  const userPeriods = await getFirestore()
    .collectionGroup('providerCostPeriods')
    .where('periodKey', '==', periodKey)
    .get();

  let committedCredits = 0;
  let knownCostUsd = 0;
  let unknownCostEventCount = 0;
  let totalEventCount = 0;

  for (const doc of userPeriods.docs) {
    const data = doc.data();
    committedCredits +=
      typeof data.committedCredits === 'number' ? data.committedCredits : 0;
    knownCostUsd += typeof data.knownCostUsd === 'number' ? data.knownCostUsd : 0;
    unknownCostEventCount +=
      typeof data.unknownCostEventCount === 'number'
        ? data.unknownCostEventCount
        : 0;
    totalEventCount +=
      typeof data.totalEventCount === 'number' ? data.totalEventCount : 0;
  }

  await adminProviderCostPeriodRef(periodKey).set(
    {
      periodKey,
      committedCredits,
      knownCostUsd,
      unknownCostEventCount,
      totalEventCount,
      costUsdPerCommittedCredit:
        committedCredits > 0 ? knownCostUsd / committedCredits : undefined,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function recordProviderCallSafe(
  params: IRecordProviderCallParams,
): Promise<void> {
  try {
    await recordProviderCall(params);
  } catch {
    // Swallow — cost tracking must not break generation.
  }
}

export function modalityFromCall(params: {
  modality?: LlmModality;
  defaultModality?: LlmModality;
}): LlmModality {
  return params.modality ?? params.defaultModality ?? 'text';
}
