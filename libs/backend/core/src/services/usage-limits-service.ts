import {
  buildUsagePeriodKey,
  buildUsagePeriodResetAt,
  calculateRemainingCredits,
  type GenerationKind,
  type IUsageFeaturePolicies,
  type IUsageLimitsSetup,
  type IUsagePeriodSummary,
  type IUserUsageSummary,
  type UsageLimitEventType,
} from '@shared-types';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  evaluateUsageLimitDecision,
  mapJobKindToUsageGenerationKind,
  resolveUsageGenerationKind,
} from './usage-limits-logic';

const USAGE_LIMITS_SETUPS_COLLECTION = 'usageLimitsSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';

export class UsageLimitError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'USER_GROUP_NOT_ASSIGNED'
      | 'USER_GROUP_NOT_FOUND'
      | 'USAGE_LIMITS_SETUP_NOT_FOUND'
      | 'FEATURE_DISABLED'
      | 'INSUFFICIENT_CREDITS'
      | 'RESERVATION_NOT_FOUND'
      | 'RESERVATION_ALREADY_SETTLED',
    public readonly details?: {
      generationKind?: GenerationKind;
      remainingCredits?: number;
      resetAt?: string;
      creditCost?: number;
    }
  ) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

export interface IUsageReservation {
  id: string;
  userId: string;
  userGroupId: string;
  usageLimitsSetupId: string;
  llmSetupId: string;
  generationKind: GenerationKind;
  credits: number;
  periodKey: string;
  status: 'pending' | 'committed' | 'refunded';
  createdAt: string;
}

interface IUserUsageContext {
  userId: string;
  userGroupId: string;
  llmSetupId: string;
  setup: IUsageLimitsSetup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFeaturePolicies(value: unknown): IUsageFeaturePolicies | null {
  if (!isRecord(value)) {
    return null;
  }

  const policies = {} as IUsageFeaturePolicies;
  for (const [kind, policyValue] of Object.entries(value)) {
    if (!isRecord(policyValue)) {
      return null;
    }

    const enabled = policyValue.enabled;
    const creditCost = policyValue.creditCost;
    if (typeof enabled !== 'boolean' || typeof creditCost !== 'number' || creditCost < 0) {
      return null;
    }

    policies[kind as GenerationKind] = { enabled, creditCost };
  }

  return policies;
}

function parseUsageLimitsSetup(id: string, data: FirebaseFirestore.DocumentData): IUsageLimitsSetup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const monthlyCreditAllowance =
    typeof data.monthlyCreditAllowance === 'number' ? data.monthlyCreditAllowance : NaN;
  const featurePolicies = parseFeaturePolicies(data.featurePolicies);

  if (!name || !Number.isFinite(monthlyCreditAllowance) || monthlyCreditAllowance < 0 || !featurePolicies) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    monthlyCreditAllowance,
    featurePolicies,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function usagePeriodRef(userId: string, periodKey: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usagePeriods')
    .doc(periodKey);
}

function usageReservationRef(userId: string, reservationId: string) {
  return getFirestore()
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection('usageReservations')
    .doc(reservationId);
}

function usageEventsCollection(userId: string) {
  return getFirestore().collection(USERS_COLLECTION).doc(userId).collection('usageEvents');
}

async function resolveUserUsageContext(userId: string): Promise<IUserUsageContext> {
  const userSnapshot = await getFirestore().collection(USERS_COLLECTION).doc(userId).get();
  const userGroupId =
    typeof userSnapshot.data()?.userGroupId === 'string'
      ? userSnapshot.data()?.userGroupId.trim()
      : '';

  if (!userGroupId) {
    throw new UsageLimitError('User group is not assigned.', 'USER_GROUP_NOT_ASSIGNED');
  }

  const groupSnapshot = await getFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .doc(userGroupId)
    .get();

  if (!groupSnapshot.exists) {
    throw new UsageLimitError('User group not found.', 'USER_GROUP_NOT_FOUND');
  }

  const groupData = groupSnapshot.data() ?? {};
  const llmSetupId = typeof groupData.llmSetupId === 'string' ? groupData.llmSetupId.trim() : '';
  const usageLimitsSetupId =
    typeof groupData.usageLimitsSetupId === 'string'
      ? groupData.usageLimitsSetupId.trim()
      : '';

  if (!usageLimitsSetupId) {
    throw new UsageLimitError(
      'Usage limits setup is not assigned to this user group.',
      'USAGE_LIMITS_SETUP_NOT_FOUND'
    );
  }

  const setupSnapshot = await getFirestore()
    .collection(USAGE_LIMITS_SETUPS_COLLECTION)
    .doc(usageLimitsSetupId)
    .get();

  if (!setupSnapshot.exists) {
    throw new UsageLimitError('Usage limits setup not found.', 'USAGE_LIMITS_SETUP_NOT_FOUND');
  }

  const setup = parseUsageLimitsSetup(setupSnapshot.id, setupSnapshot.data() ?? {});
  if (!setup) {
    throw new UsageLimitError('Usage limits setup data is invalid.', 'USAGE_LIMITS_SETUP_NOT_FOUND');
  }

  return {
    userId,
    userGroupId,
    llmSetupId,
    setup,
  };
}

async function appendUsageEvent(params: {
  userId: string;
  type: UsageLimitEventType;
  userGroupId: string;
  usageLimitsSetupId: string;
  llmSetupId?: string;
  generationKind: GenerationKind;
  credits: number;
  periodKey: string;
  reservationId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await usageEventsCollection(params.userId).add({
    type: params.type,
    userId: params.userId,
    userGroupId: params.userGroupId,
    usageLimitsSetupId: params.usageLimitsSetupId,
    llmSetupId: params.llmSetupId,
    generationKind: params.generationKind,
    credits: params.credits,
    periodKey: params.periodKey,
    reservationId: params.reservationId,
    createdAt: now,
  });
}

export async function reserveUsageCredits(params: {
  userId: string;
  generationKind: GenerationKind | string;
  quantity?: number;
}): Promise<IUsageReservation> {
  const generationKind = resolveUsageGenerationKind(params.generationKind);
  const context = await resolveUserUsageContext(params.userId);
  const policy = context.setup.featurePolicies[generationKind];
  if (!policy) {
    throw new UsageLimitError(
      `No usage policy configured for ${generationKind}.`,
      'FEATURE_DISABLED',
      { generationKind }
    );
  }

  const periodKey = buildUsagePeriodKey();
  const periodRef = usagePeriodRef(params.userId, periodKey);
  const reservationId = getFirestore().collection(USERS_COLLECTION).doc().id;
  const reservationDocRef = usageReservationRef(params.userId, reservationId);

  const reservation = await getFirestore().runTransaction(async (transaction) => {
    const periodSnapshot = await transaction.get(periodRef);
    const periodData = periodSnapshot.data() ?? {};
    const allowance =
      typeof periodData.allowance === 'number'
        ? periodData.allowance
        : context.setup.monthlyCreditAllowance;
    const reservedCredits =
      typeof periodData.reservedCredits === 'number' ? periodData.reservedCredits : 0;
    const spentCredits = typeof periodData.spentCredits === 'number' ? periodData.spentCredits : 0;
    const refundedCredits =
      typeof periodData.refundedCredits === 'number' ? periodData.refundedCredits : 0;

    const decision = evaluateUsageLimitDecision({
      policy,
      period: { allowance, reservedCredits, spentCredits, refundedCredits },
      quantity: params.quantity,
    });

    if (decision.allowed === false) {
      throw new UsageLimitError(decision.message, decision.code, {
        generationKind,
        remainingCredits: decision.remainingCredits,
        resetAt: buildUsagePeriodResetAt(periodKey),
        creditCost: decision.credits,
      });
    }

    const now = new Date().toISOString();
    transaction.set(
      periodRef,
      {
        periodKey,
        allowance,
        usageLimitsSetupId: context.setup.id,
        reservedCredits: reservedCredits + decision.credits,
        spentCredits,
        refundedCredits,
        blockedCount: FieldValue.increment(0),
        updatedAt: now,
      },
      { merge: true }
    );

    transaction.set(reservationDocRef, {
      id: reservationId,
      userId: params.userId,
      userGroupId: context.userGroupId,
      usageLimitsSetupId: context.setup.id,
      llmSetupId: context.llmSetupId,
      generationKind,
      credits: decision.credits,
      periodKey,
      status: 'pending',
      createdAt: now,
    });

    return {
      id: reservationId,
      userId: params.userId,
      userGroupId: context.userGroupId,
      usageLimitsSetupId: context.setup.id,
      llmSetupId: context.llmSetupId,
      generationKind,
      credits: decision.credits,
      periodKey,
      status: 'pending' as const,
      createdAt: now,
    };
  });

  await appendUsageEvent({
    userId: params.userId,
    type: 'reserve',
    userGroupId: context.userGroupId,
    usageLimitsSetupId: context.setup.id,
    llmSetupId: context.llmSetupId,
    generationKind,
    credits: reservation.credits,
    periodKey: reservation.periodKey,
    reservationId: reservation.id,
  });

  return reservation;
}

export async function commitUsageReservation(userId: string, reservationId: string): Promise<void> {
  const reservationRef = usageReservationRef(userId, reservationId);

  const settled = await getFirestore().runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists) {
      throw new UsageLimitError('Usage reservation not found.', 'RESERVATION_NOT_FOUND');
    }

    const reservationData = reservationSnapshot.data() ?? {};
    const status = reservationData.status;
    if (status === 'committed' || status === 'refunded') {
      return null;
    }

    if (status !== 'pending') {
      throw new UsageLimitError('Usage reservation is invalid.', 'RESERVATION_NOT_FOUND');
    }

    const credits = typeof reservationData.credits === 'number' ? reservationData.credits : 0;
    const periodKey =
      typeof reservationData.periodKey === 'string' ? reservationData.periodKey : buildUsagePeriodKey();
    const periodRef = usagePeriodRef(userId, periodKey);
    const periodSnapshot = await transaction.get(periodRef);
    const periodData = periodSnapshot.data() ?? {};
    const reservedCredits =
      typeof periodData.reservedCredits === 'number' ? periodData.reservedCredits : 0;
    const spentCredits = typeof periodData.spentCredits === 'number' ? periodData.spentCredits : 0;

    transaction.set(
      periodRef,
      {
        reservedCredits: Math.max(0, reservedCredits - credits),
        spentCredits: spentCredits + credits,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    transaction.set(
      reservationRef,
      {
        status: 'committed',
        settledAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      userGroupId:
        typeof reservationData.userGroupId === 'string' ? reservationData.userGroupId : '',
      usageLimitsSetupId:
        typeof reservationData.usageLimitsSetupId === 'string'
          ? reservationData.usageLimitsSetupId
          : '',
      llmSetupId:
        typeof reservationData.llmSetupId === 'string' ? reservationData.llmSetupId : undefined,
      generationKind: reservationData.generationKind as GenerationKind,
      credits,
      periodKey,
    };
  });

  if (!settled) {
    return;
  }

  await appendUsageEvent({
    userId,
    type: 'commit',
    userGroupId: settled.userGroupId,
    usageLimitsSetupId: settled.usageLimitsSetupId,
    llmSetupId: settled.llmSetupId,
    generationKind: settled.generationKind,
    credits: settled.credits,
    periodKey: settled.periodKey,
    reservationId,
  });
}

export async function refundUsageReservation(userId: string, reservationId: string): Promise<void> {
  const reservationRef = usageReservationRef(userId, reservationId);

  const settled = await getFirestore().runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists) {
      throw new UsageLimitError('Usage reservation not found.', 'RESERVATION_NOT_FOUND');
    }

    const reservationData = reservationSnapshot.data() ?? {};
    const status = reservationData.status;
    if (status === 'refunded' || status === 'committed') {
      return null;
    }

    if (status !== 'pending') {
      throw new UsageLimitError('Usage reservation is invalid.', 'RESERVATION_NOT_FOUND');
    }

    const credits = typeof reservationData.credits === 'number' ? reservationData.credits : 0;
    const periodKey =
      typeof reservationData.periodKey === 'string' ? reservationData.periodKey : buildUsagePeriodKey();
    const periodRef = usagePeriodRef(userId, periodKey);
    const periodSnapshot = await transaction.get(periodRef);
    const periodData = periodSnapshot.data() ?? {};
    const reservedCredits =
      typeof periodData.reservedCredits === 'number' ? periodData.reservedCredits : 0;
    const refundedCredits =
      typeof periodData.refundedCredits === 'number' ? periodData.refundedCredits : 0;

    transaction.set(
      periodRef,
      {
        reservedCredits: Math.max(0, reservedCredits - credits),
        refundedCredits: refundedCredits + credits,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    transaction.set(
      reservationRef,
      {
        status: 'refunded',
        settledAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      userGroupId:
        typeof reservationData.userGroupId === 'string' ? reservationData.userGroupId : '',
      usageLimitsSetupId:
        typeof reservationData.usageLimitsSetupId === 'string'
          ? reservationData.usageLimitsSetupId
          : '',
      llmSetupId:
        typeof reservationData.llmSetupId === 'string' ? reservationData.llmSetupId : undefined,
      generationKind: reservationData.generationKind as GenerationKind,
      credits,
      periodKey,
    };
  });

  if (!settled) {
    return;
  }

  await appendUsageEvent({
    userId,
    type: 'refund',
    userGroupId: settled.userGroupId,
    usageLimitsSetupId: settled.usageLimitsSetupId,
    llmSetupId: settled.llmSetupId,
    generationKind: settled.generationKind,
    credits: settled.credits,
    periodKey: settled.periodKey,
    reservationId,
  });
}

export async function getUserUsageSummary(userId: string): Promise<IUserUsageSummary> {
  const context = await resolveUserUsageContext(userId);
  const periodKey = buildUsagePeriodKey();
  const periodSnapshot = await usagePeriodRef(userId, periodKey).get();
  const periodData = periodSnapshot.data() ?? {};

  const allowance =
    typeof periodData.allowance === 'number'
      ? periodData.allowance
      : context.setup.monthlyCreditAllowance;
  const reservedCredits =
    typeof periodData.reservedCredits === 'number' ? periodData.reservedCredits : 0;
  const spentCredits = typeof periodData.spentCredits === 'number' ? periodData.spentCredits : 0;
  const refundedCredits =
    typeof periodData.refundedCredits === 'number' ? periodData.refundedCredits : 0;
  const remainingCredits = calculateRemainingCredits({
    allowance,
    reservedCredits,
    spentCredits,
  });

  const featureAvailability = Object.entries(context.setup.featurePolicies).map(([kind, policy]) => ({
    kind: kind as GenerationKind,
    enabled: policy.enabled,
    creditCost: policy.creditCost,
    affordable: policy.enabled && remainingCredits >= policy.creditCost,
  }));

  return {
    periodKey,
    allowance,
    reservedCredits,
    spentCredits,
    refundedCredits,
    remainingCredits,
    resetAt: buildUsagePeriodResetAt(periodKey),
    usageLimitsSetupId: context.setup.id,
    usageLimitsSetupName: context.setup.name,
    featureAvailability,
  };
}

export async function listRecentUsageEvents(
  userId: string,
  limit = 20
): Promise<Array<Record<string, unknown>>> {
  const snapshot = await usageEventsCollection(userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getUsagePeriodSummary(userId: string): Promise<IUsagePeriodSummary> {
  const summary = await getUserUsageSummary(userId);
  return {
    periodKey: summary.periodKey,
    allowance: summary.allowance,
    reservedCredits: summary.reservedCredits,
    spentCredits: summary.spentCredits,
    refundedCredits: summary.refundedCredits,
    remainingCredits: summary.remainingCredits,
    resetAt: summary.resetAt,
    usageLimitsSetupId: summary.usageLimitsSetupId,
    usageLimitsSetupName: summary.usageLimitsSetupName,
  };
}

export async function settleJobUsageReservation(params: {
  userId: string;
  reservationId?: string;
  succeeded: boolean;
}): Promise<void> {
  if (!params.reservationId) {
    return;
  }

  if (params.succeeded) {
    await commitUsageReservation(params.userId, params.reservationId);
    return;
  }

  await refundUsageReservation(params.userId, params.reservationId);
}

export { mapJobKindToUsageGenerationKind, resolveUsageGenerationKind };
