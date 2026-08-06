import 'server-only';

import {
  buildUsagePeriodKey,
  buildUsagePeriodResetAt,
  calculateRemainingCredits,
  type IUsagePeriodSummary,
} from '@shared-types';
import { getAdminFirestore } from '../firebase/admin';
import { requireAdminSession } from '../auth/session';

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';

export interface IAdminUserUsageReport {
  period: IUsagePeriodSummary;
  recentEvents: Array<Record<string, unknown>>;
}

async function resolveUsageLimitsSetupName(setupId: string): Promise<string | undefined> {
  const doc = await getAdminFirestore().collection(USAGE_LIMITS_SETUPS_COLLECTION).doc(setupId).get();
  const name = doc.data()?.name;
  return typeof name === 'string' ? name : undefined;
}

async function resolveUserUsageLimitsSetupId(userId: string): Promise<string | null> {
  const userDoc = await getAdminFirestore().collection(USERS_COLLECTION).doc(userId).get();
  const userGroupId =
    typeof userDoc.data()?.userGroupId === 'string' ? userDoc.data()?.userGroupId.trim() : '';

  if (!userGroupId) {
    return null;
  }

  const groupDoc = await getAdminFirestore().collection(USER_GROUPS_COLLECTION).doc(userGroupId).get();
  const usageLimitsSetupId =
    typeof groupDoc.data()?.usageLimitsSetupId === 'string'
      ? groupDoc.data()?.usageLimitsSetupId.trim()
      : '';

  return usageLimitsSetupId || null;
}

export async function getAdminUserUsageReport(userId: string): Promise<IAdminUserUsageReport | null> {
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
    typeof setupData.monthlyCreditAllowance === 'number' ? setupData.monthlyCreditAllowance : 0;
  const periodKey = buildUsagePeriodKey();
  const periodDoc = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usagePeriods')
    .doc(periodKey)
    .get();
  const periodData = periodDoc.data() ?? {};

  const allowance =
    typeof periodData.allowance === 'number' ? periodData.allowance : allowanceFromSetup;
  const reservedCredits =
    typeof periodData.reservedCredits === 'number' ? periodData.reservedCredits : 0;
  const spentCredits = typeof periodData.spentCredits === 'number' ? periodData.spentCredits : 0;
  const refundedCredits =
    typeof periodData.refundedCredits === 'number' ? periodData.refundedCredits : 0;

  const period: IUsagePeriodSummary = {
    periodKey,
    allowance,
    reservedCredits,
    spentCredits,
    refundedCredits,
    remainingCredits: calculateRemainingCredits({ allowance, reservedCredits, spentCredits }),
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
