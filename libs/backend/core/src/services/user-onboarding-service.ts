import type { IUserProfile } from '@shared-types';
import {
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
} from '@shared-types';
import { getFirestore } from 'firebase-admin/firestore';
import { getUserUsageSummary } from './usage-limits-service';

const USERS_COLLECTION = 'users';
const USER_GROUPS_COLLECTION = 'userGroups';
const BILLING_STATE_DOC_ID = 'current';

function usersRef(userId: string) {
  return getFirestore().collection(USERS_COLLECTION).doc(userId);
}

function billingStateRef(userId: string) {
  return usersRef(userId).collection('billing').doc(BILLING_STATE_DOC_ID);
}

function isDefaultRegistrationGroup(data: FirebaseFirestore.DocumentData): boolean {
  return data.isDefaultRegistrationGroup === true;
}

async function resolveDefaultRegistrationGroupId(): Promise<string> {
  const snapshot = await getFirestore()
    .collection(USER_GROUPS_COLLECTION)
    .where('isDefaultRegistrationGroup', '==', true)
    .limit(2)
    .get();

  if (snapshot.empty) {
    throw new Error('Default registration user group is not configured.');
  }

  if (snapshot.size > 1) {
    throw new Error('More than one default registration user group is configured.');
  }

  const group = snapshot.docs[0];
  if (!group || !isDefaultRegistrationGroup(group.data())) {
    throw new Error('Default registration user group is invalid.');
  }

  return group.id;
}

function parseUserProfile(
  uid: string,
  data: FirebaseFirestore.DocumentData,
): IUserProfile {
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : undefined,
    displayName:
      typeof data.displayName === 'string' ? data.displayName : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    userGroupId:
      typeof data.userGroupId === 'string' ? data.userGroupId : undefined,
    emailVerificationExempt: data.emailVerificationExempt === true,
  };
}

export async function userHasEmailVerificationExemption(
  userId: string,
): Promise<boolean> {
  const snapshot = await usersRef(userId).get();
  return snapshot.data()?.emailVerificationExempt === true;
}

export async function bootstrapUserProfile(params: {
  userId: string;
  email?: string;
  displayName?: string;
}): Promise<IUserProfile> {
  const userRef = usersRef(params.userId);
  const existingSnapshot = await userRef.get();
  const existing = existingSnapshot.data() ?? {};
  const now = new Date().toISOString();
  const userGroupId =
    typeof existing.userGroupId === 'string' && existing.userGroupId.trim()
      ? existing.userGroupId.trim()
      : await resolveDefaultRegistrationGroupId();

  const email =
    typeof params.email === 'string' && params.email.trim()
      ? params.email.trim()
      : typeof existing.email === 'string' && existing.email.trim()
        ? existing.email.trim()
        : undefined;
  const displayName =
    typeof params.displayName === 'string' && params.displayName.trim()
      ? params.displayName.trim()
      : typeof existing.displayName === 'string' && existing.displayName.trim()
        ? existing.displayName.trim()
        : undefined;

  await userRef.set(
    {
      uid: params.userId,
      ...(email ? { email } : {}),
      ...(displayName ? { displayName } : {}),
      userGroupId,
      emailVerificationExempt: existing.emailVerificationExempt === true,
      createdAt:
        typeof existing.createdAt === 'string' && existing.createdAt.trim()
          ? existing.createdAt
          : now,
      updatedAt: now,
    },
    { merge: true },
  );

  const billingRef = billingStateRef(params.userId);
  await getFirestore().runTransaction(async (transaction) => {
    const billingSnapshot = await transaction.get(billingRef);
    if (billingSnapshot.exists) {
      return;
    }

    transaction.set(billingRef, {
      payAsYouGoEnabled: false,
      monthlyCapCents: DEFAULT_PAYG_MONTHLY_CAP_CENTS,
      pricePerCreditCents: DEFAULT_PRICE_PER_CREDIT_CENTS,
      billingStatus: 'none',
      subscriptionStatus: 'none',
      updatedAt: now,
    });
  });

  await getUserUsageSummary(params.userId);

  const updatedSnapshot = await userRef.get();
  return parseUserProfile(params.userId, updatedSnapshot.data() ?? {});
}
