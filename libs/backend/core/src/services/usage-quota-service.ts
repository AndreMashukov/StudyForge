import {
  buildUsageDayKey,
  buildUsageDayResetAt,
  calculateRemainingDailySlideDecks,
  calculateRemainingStorageBytes,
  type IUsageDailySlideDeckSummary,
  type IUsageLimitsSetup,
  type IUsageStorageSummary,
} from '@shared-types';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { UsageLimitError } from './usage-limit-error';
import {
  evaluateDailySlideDeckQuotaDecision,
  evaluateStorageQuotaDecision,
  readDailySlideDeckState,
} from './usage-quota-logic';

const USERS_COLLECTION = 'users';
const STORAGE_USAGE_DOC_ID = 'current';
const DAILY_SLIDE_DECK_RESERVATIONS_COLLECTION = 'dailySlideDeckReservations';

export interface IDailySlideDeckReservation {
  id: string;
  userId: string;
  dayKey: string;
  status: 'pending' | 'committed' | 'refunded';
  createdAt: string;
}

export interface IUserUsageLimitsContext {
  userId: string;
  userGroupId: string;
  llmSetupId: string;
  setup: IUsageLimitsSetup;
}

function storageUsageRef(userId: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('storageUsage')
    .doc(STORAGE_USAGE_DOC_ID);
}

function dailyUsageRef(userId: string, dayKey: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('dailyUsage')
    .doc(dayKey);
}

function dailySlideDeckReservationRef(userId: string, reservationId: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(DAILY_SLIDE_DECK_RESERVATIONS_COLLECTION)
    .doc(reservationId);
}

export async function getUserStorageUsedBytes(userId: string): Promise<number> {
  const snapshot = await storageUsageRef(userId).get();
  const usedBytes = snapshot.data()?.usedBytes;
  return typeof usedBytes === 'number' && Number.isFinite(usedBytes) ? Math.max(0, usedBytes) : 0;
}

export async function buildStorageUsageSummary(
  context: IUserUsageLimitsContext,
): Promise<IUsageStorageSummary> {
  const usedBytes = await getUserStorageUsedBytes(context.userId);
  const limitBytes = context.setup.storageLimitBytes;
  return {
    usedBytes,
    limitBytes,
    remainingBytes: calculateRemainingStorageBytes({ limitBytes, usedBytes }),
  };
}

export async function buildDailySlideDeckUsageSummary(
  context: IUserUsageLimitsContext,
  dayKey: string = buildUsageDayKey(),
): Promise<IUsageDailySlideDeckSummary> {
  const snapshot = await dailyUsageRef(context.userId, dayKey).get();
  const state = readDailySlideDeckState(snapshot.data() ?? {});
  const limit = context.setup.dailySlideDeckLimit;
  const used = state.reservedSlideDecks + state.completedSlideDecks;

  return {
    dayKey,
    used,
    limit,
    remaining: calculateRemainingDailySlideDecks({
      limit,
      reservedSlideDecks: state.reservedSlideDecks,
      completedSlideDecks: state.completedSlideDecks,
    }),
    resetAt: buildUsageDayResetAt(dayKey),
  };
}

export async function assertStorageQuotaAvailable(params: {
  context: IUserUsageLimitsContext;
  requestedBytes: number;
}): Promise<void> {
  const usedBytes = await getUserStorageUsedBytes(params.context.userId);
  const decision = evaluateStorageQuotaDecision({
    limitBytes: params.context.setup.storageLimitBytes,
    usedBytes,
    requestedBytes: params.requestedBytes,
  });

  if (decision.allowed === false) {
    throw new UsageLimitError(decision.message, decision.code, {
      remainingBytes: decision.remainingBytes,
      storageUsedBytes: decision.usedBytes,
      storageLimitBytes: decision.limitBytes,
    });
  }
}

export async function adjustUserStorageUsage(params: {
  userId: string;
  deltaBytes: number;
}): Promise<void> {
  if (!Number.isFinite(params.deltaBytes) || params.deltaBytes === 0) {
    return;
  }

  await getFirestore().runTransaction(async (transaction) => {
    const ref = storageUsageRef(params.userId);
    const snapshot = await transaction.get(ref);
    const currentUsed =
      typeof snapshot.data()?.usedBytes === 'number' ? snapshot.data()?.usedBytes : 0;
    const nextUsed = Math.max(0, currentUsed + params.deltaBytes);

    transaction.set(
      ref,
      {
        usedBytes: nextUsed,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  });
}

export async function reserveDailySlideDeckSlot(
  context: IUserUsageLimitsContext,
): Promise<IDailySlideDeckReservation> {
  const dayKey = buildUsageDayKey();
  const reservationId = getFirestore().collection(USERS_COLLECTION).doc().id;
  const reservationRef = dailySlideDeckReservationRef(context.userId, reservationId);
  const dayRef = dailyUsageRef(context.userId, dayKey);

  const reservation = await getFirestore().runTransaction(async (transaction) => {
    const daySnapshot = await transaction.get(dayRef);
    const state = readDailySlideDeckState(daySnapshot.data() ?? {});
    const decision = evaluateDailySlideDeckQuotaDecision({
      limit: context.setup.dailySlideDeckLimit,
      dayKey,
      state,
    });

    if (decision.allowed === false) {
      throw new UsageLimitError(decision.message, decision.code, {
        resetAt: decision.resetAt,
        dailySlideDecksUsed: decision.used,
        dailySlideDeckLimit: decision.limit,
        dailySlideDecksRemaining: decision.remaining,
      });
    }

    const now = new Date().toISOString();
    transaction.set(
      dayRef,
      {
        dayKey,
        reservedSlideDecks: state.reservedSlideDecks + 1,
        completedSlideDecks: state.completedSlideDecks,
        refundedSlideDecks: state.refundedSlideDecks,
        updatedAt: now,
      },
      { merge: true },
    );

    transaction.set(reservationRef, {
      id: reservationId,
      userId: context.userId,
      dayKey,
      status: 'pending',
      createdAt: now,
    });

    return {
      id: reservationId,
      userId: context.userId,
      dayKey,
      status: 'pending' as const,
      createdAt: now,
    };
  });

  return reservation;
}

async function settleDailySlideDeckReservation(params: {
  userId: string;
  reservationId: string;
  nextStatus: 'committed' | 'refunded';
}): Promise<void> {
  const reservationRef = dailySlideDeckReservationRef(params.userId, params.reservationId);

  await getFirestore().runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists) {
      throw new UsageLimitError('Daily slide deck reservation not found.', 'RESERVATION_NOT_FOUND');
    }

    const reservationData = reservationSnapshot.data() ?? {};
    const status = reservationData.status;
    if (status === 'committed' || status === 'refunded') {
      return;
    }

    if (status !== 'pending') {
      throw new UsageLimitError('Daily slide deck reservation is invalid.', 'RESERVATION_NOT_FOUND');
    }

    const dayKey = typeof reservationData.dayKey === 'string' ? reservationData.dayKey : buildUsageDayKey();
    const dayRef = dailyUsageRef(params.userId, dayKey);
    const daySnapshot = await transaction.get(dayRef);
    const state = readDailySlideDeckState(daySnapshot.data() ?? {});

    if (params.nextStatus === 'committed') {
      transaction.set(
        dayRef,
        {
          dayKey,
          reservedSlideDecks: Math.max(0, state.reservedSlideDecks - 1),
          completedSlideDecks: state.completedSlideDecks + 1,
          refundedSlideDecks: state.refundedSlideDecks,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } else {
      transaction.set(
        dayRef,
        {
          dayKey,
          reservedSlideDecks: Math.max(0, state.reservedSlideDecks - 1),
          completedSlideDecks: state.completedSlideDecks,
          refundedSlideDecks: state.refundedSlideDecks + 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    transaction.set(
      reservationRef,
      {
        status: params.nextStatus,
        settledAt: new Date().toISOString(),
      },
      { merge: true },
    );
  });
}

export async function commitDailySlideDeckReservation(
  userId: string,
  reservationId?: string,
): Promise<void> {
  if (!reservationId) {
    return;
  }

  await settleDailySlideDeckReservation({
    userId,
    reservationId,
    nextStatus: 'committed',
  });
}

export async function refundDailySlideDeckReservation(
  userId: string,
  reservationId?: string,
): Promise<void> {
  if (!reservationId) {
    return;
  }

  await settleDailySlideDeckReservation({
    userId,
    reservationId,
    nextStatus: 'refunded',
  }).catch(() => undefined);
}

export async function setUserStorageUsedBytes(userId: string, usedBytes: number): Promise<void> {
  await storageUsageRef(userId).set(
    {
      usedBytes: Math.max(0, usedBytes),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function incrementBlockedCount(userId: string, dayKey: string): Promise<void> {
  await dailyUsageRef(userId, dayKey).set(
    {
      blockedCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
