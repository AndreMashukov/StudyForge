import 'server-only';

import {
  ALL_GENERATION_KINDS,
  buildUsageDayKey,
  buildUsageDayResetAt,
  buildUsagePeriodKey,
  buildUsagePeriodResetAt,
  calculateDailySlideDecksUsed,
  calculateRemainingCredits,
  calculateRemainingDailySlideDecks,
  calculateRemainingStorageBytes,
  resolveLivePeriodAllowance,
  type IUsageFeatureAvailability,
  type IUsagePeriodSummary,
} from '@shared-types';
import { getAdminFirestore } from '../firebase/admin';
import { requireAdminSession } from '../auth/session';
import { parseUsageLimitsSetup } from './usage-limits-setups';

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';
const USAGE_SUMMARY_DOC_ID = 'current';
const STORAGE_USAGE_DOC_ID = 'current';

export interface IAdminUserUsageReport {
  period: IUsagePeriodSummary;
  recentEvents: Array<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function resolveUsageLimitsSetupName(
  setupId: string,
): Promise<string | undefined> {
  const doc = await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(setupId)
    .get();
  const name = doc.data()?.name;
  return typeof name === 'string' ? name : undefined;
}

async function resolveUserUsageLimitsSetupId(
  userId: string,
): Promise<string | null> {
  const userDoc = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .get();
  const userGroupId =
    typeof userDoc.data()?.userGroupId === 'string'
      ? userDoc.data()?.userGroupId.trim()
      : '';

  if (!userGroupId) {
    return null;
  }

  const groupDoc = await getAdminFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .doc(userGroupId)
    .get();
  const usageLimitsSetupId =
    typeof groupDoc.data()?.usageLimitsSetupId === 'string'
      ? groupDoc.data()?.usageLimitsSetupId.trim()
      : '';

  return usageLimitsSetupId || null;
}

function readPeriodCreditTotals(periodData: FirebaseFirestore.DocumentData) {
  return {
    reservedCredits: readNumber(periodData.reservedCredits),
    spentCredits: readNumber(periodData.spentCredits),
    refundedCredits: readNumber(periodData.refundedCredits),
    reservedOverageCredits: readNumber(periodData.reservedOverageCredits),
    spentOverageCredits: readNumber(periodData.spentOverageCredits),
    overageAmountCents: readNumber(periodData.overageAmountCents),
  };
}

export async function getAdminUserUsageReport(
  userId: string,
): Promise<IAdminUserUsageReport | null> {
  await requireAdminSession();

  const usageLimitsSetupId = await resolveUserUsageLimitsSetupId(userId);
  if (!usageLimitsSetupId) {
    return null;
  }

  const setupDoc = await getAdminFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(usageLimitsSetupId)
    .get();

  if (!setupDoc.exists) {
    return null;
  }

  const setupData = setupDoc.data() ?? {};
  const allowanceFromSetup =
    typeof setupData.monthlyCreditAllowance === 'number'
      ? setupData.monthlyCreditAllowance
      : 0;
  const periodKey = buildUsagePeriodKey();
  const periodDoc = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usagePeriods')
    .doc(periodKey)
    .get();
  const periodData = periodDoc.data() ?? {};
  const totals = readPeriodCreditTotals(periodData);
  const allowance = resolveLivePeriodAllowance(allowanceFromSetup);

  const period: IUsagePeriodSummary = {
    periodKey,
    allowance,
    reservedCredits: totals.reservedCredits,
    spentCredits: totals.spentCredits,
    refundedCredits: totals.refundedCredits,
    remainingCredits: calculateRemainingCredits({
      allowance,
      reservedCredits: totals.reservedCredits,
      spentCredits: totals.spentCredits,
    }),
    resetAt: buildUsagePeriodResetAt(periodKey),
    usageLimitsSetupId,
    usageLimitsSetupName: await resolveUsageLimitsSetupName(usageLimitsSetupId),
  };

  const eventsSnapshot = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usageEvents')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const recentEvents = eventsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return { period, recentEvents };
}

export async function refreshUserUsageAfterLimitsChange(
  userId: string,
): Promise<void> {
  await requireAdminSession();

  const usageLimitsSetupId = await resolveUserUsageLimitsSetupId(userId);
  if (!usageLimitsSetupId) {
    return;
  }

  const db = getAdminFirestore();
  const setupDoc = await db
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(usageLimitsSetupId)
    .get();
  const setup = parseUsageLimitsSetup(setupDoc.id, setupDoc.data() ?? {});
  if (!setupDoc.exists || !setup) {
    return;
  }

  const periodKey = buildUsagePeriodKey();
  const dayKey = buildUsageDayKey();
  const now = new Date().toISOString();
  const userRef = db.collection(USERS_COLLECTION).doc(userId);
  const periodRef = userRef.collection('usagePeriods').doc(periodKey);
  const summaryRef = userRef
    .collection('usageSummary')
    .doc(USAGE_SUMMARY_DOC_ID);
  const storageRef = userRef
    .collection('storageUsage')
    .doc(STORAGE_USAGE_DOC_ID);
  const dailyRef = userRef.collection('dailyUsage').doc(dayKey);

  const [periodSnap, summarySnap, storageSnap, dailySnap] = await Promise.all([
    periodRef.get(),
    summaryRef.get(),
    storageRef.get(),
    dailyRef.get(),
  ]);

  const periodData = periodSnap.data() ?? {};
  const totals = readPeriodCreditTotals(periodData);
  const allowance = resolveLivePeriodAllowance(setup.monthlyCreditAllowance);
  const remainingCredits = calculateRemainingCredits({
    allowance,
    reservedCredits: totals.reservedCredits,
    spentCredits: totals.spentCredits,
  });
  const usedBytes = readNumber(storageSnap.data()?.usedBytes);
  const reservedSlideDecks = readNumber(dailySnap.data()?.reservedSlideDecks);
  const completedSlideDecks = readNumber(dailySnap.data()?.completedSlideDecks);
  const existingPayAsYouGo = summarySnap.data()?.payAsYouGo;
  const canUseOverage =
    isRecord(existingPayAsYouGo) &&
    existingPayAsYouGo.enabled === true &&
    existingPayAsYouGo.hasPaymentMethod === true;

  const featureAvailability: IUsageFeatureAvailability[] =
    ALL_GENERATION_KINDS.map((kind) => {
      const policy = setup.featurePolicies[kind];
      return {
        kind,
        enabled: policy.enabled,
        creditCost: policy.creditCost,
        affordable:
          policy.enabled &&
          (remainingCredits >= policy.creditCost || canUseOverage),
        usesOverage:
          policy.enabled &&
          remainingCredits < policy.creditCost &&
          canUseOverage,
      };
    });

  await periodRef.set(
    {
      periodKey,
      allowance,
      usageLimitsSetupId: setup.id,
      updatedAt: now,
    },
    { merge: true },
  );

  await summaryRef.set(
    {
      periodKey,
      allowance,
      reservedCredits: totals.reservedCredits,
      spentCredits: totals.spentCredits,
      refundedCredits: totals.refundedCredits,
      remainingCredits,
      reservedOverageCredits: totals.reservedOverageCredits,
      spentOverageCredits: totals.spentOverageCredits,
      overageAmountCents: totals.overageAmountCents,
      resetAt: buildUsagePeriodResetAt(periodKey),
      usageLimitsSetupId: setup.id,
      usageLimitsSetupName: setup.name,
      featureAvailability,
      storage: {
        usedBytes,
        limitBytes: setup.storageLimitBytes,
        remainingBytes: calculateRemainingStorageBytes({
          limitBytes: setup.storageLimitBytes,
          usedBytes,
        }),
      },
      dailySlideDecks: {
        dayKey,
        used: calculateDailySlideDecksUsed({
          reservedSlideDecks,
          completedSlideDecks,
        }),
        limit: setup.dailySlideDeckLimit,
        remaining: calculateRemainingDailySlideDecks({
          limit: setup.dailySlideDeckLimit,
          reservedSlideDecks,
          completedSlideDecks,
        }),
        resetAt: buildUsageDayResetAt(dayKey),
      },
      updatedAt: now,
    },
    { merge: true },
  );
}

export async function refreshUsageForUsersInGroup(
  groupId: string,
): Promise<void> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .where('userGroupId', '==', groupId)
    .get();

  for (const doc of snapshot.docs) {
    await refreshUserUsageAfterLimitsChange(doc.id);
  }
}
