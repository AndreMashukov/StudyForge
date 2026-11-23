import type { IUserProfile, UserOnboarding } from '@shared-types';
import {
  DEFAULT_PAYG_MONTHLY_CAP_CENTS,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  parseUserOnboarding,
  USER_ONBOARDING_VERSION,
} from '@shared-types';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { getUserUsageSummary } from './usage-limits-service';
import {
  decideOnboardingInit,
  decideStarterDocumentClaim,
  serializeUserOnboarding,
  type StarterDocumentClaimDecision,
} from './user-onboarding-logic';

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
    onboarding: parseUserOnboarding(data.onboarding),
  };
}

/** When the Firebase Auth account was created, or undefined if unknown. */
async function readAuthCreatedAtMs(userId: string): Promise<number | undefined> {
  try {
    const user = await getAuth().getUser(userId);
    const createdAt = Date.parse(user.metadata.creationTime);
    return Number.isFinite(createdAt) ? createdAt : undefined;
  } catch (error) {
    logger.warn('Could not read Auth account creation time', {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
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

  // Bootstrap runs on every sign-in. Only a profile created right now, on a
  // recent Auth account, starts onboarding; existing accounts never see it.
  const authCreatedAtMs = existingSnapshot.exists
    ? undefined
    : await readAuthCreatedAtMs(params.userId);

  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const current = snapshot.data() ?? {};
    const startOnboarding = decideOnboardingInit({
      profileExists: snapshot.exists,
      authCreatedAtMs,
      nowMs: Date.parse(now),
    });
    const onboarding: UserOnboarding | undefined = startOnboarding
      ? {
          version: USER_ONBOARDING_VERSION,
          status: 'pending',
          createdAt: now,
          starter: { turnsUsed: 0, documentsUsed: 0, documentIds: [] },
        }
      : undefined;

    transaction.set(
      userRef,
      {
        uid: params.userId,
        ...(email ? { email } : {}),
        ...(displayName ? { displayName } : {}),
        userGroupId,
        emailVerificationExempt: current.emailVerificationExempt === true,
        createdAt:
          typeof current.createdAt === 'string' && current.createdAt.trim()
            ? current.createdAt
            : now,
        updatedAt: now,
        ...(onboarding ? { onboarding: serializeUserOnboarding(onboarding) } : {}),
      },
      { merge: true },
    );
  });

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

/** The account's onboarding state, or undefined for existing accounts. */
export async function getUserOnboarding(
  userId: string,
): Promise<UserOnboarding | undefined> {
  const snapshot = await usersRef(userId).get();
  return parseUserOnboarding(snapshot.data()?.onboarding);
}

/**
 * Reads, changes and writes users/{uid}.onboarding in one transaction.
 * `change` returns the new state, or null to leave it unchanged.
 */
export async function updateUserOnboarding<T>(
  userId: string,
  change: (onboarding: UserOnboarding | undefined) => {
    next: UserOnboarding | null;
    result: T;
  },
): Promise<T> {
  const userRef = usersRef(userId);
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const { next, result } = change(
      parseUserOnboarding(snapshot.data()?.onboarding),
    );
    if (next) {
      transaction.set(
        userRef,
        {
          onboarding: serializeUserOnboarding(next),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    return result;
  });
}

/** "Skip for now" on the welcome screen. Later states are left as they are. */
export async function skipOnboarding(
  userId: string,
): Promise<UserOnboarding | undefined> {
  return updateUserOnboarding(userId, (onboarding) => {
    if (!onboarding || onboarding.status !== 'pending') {
      return { next: null, result: onboarding };
    }
    const next: UserOnboarding = {
      ...onboarding,
      status: 'skipped',
      skippedAt: new Date().toISOString(),
    };
    return { next, result: next };
  });
}

/** Claims the one-time sample folder; false when it was already claimed. */
export async function claimSampleLibrary(userId: string): Promise<boolean> {
  return updateUserOnboarding(userId, (onboarding) => {
    if (!onboarding || onboarding.sampleClaimedAt || onboarding.sampleDirectoryId) {
      return { next: null, result: false };
    }
    return {
      next: { ...onboarding, sampleClaimedAt: new Date().toISOString() },
      result: true,
    };
  });
}

export async function recordSampleLibrary(
  userId: string,
  directoryId: string,
): Promise<void> {
  await updateUserOnboarding(userId, (onboarding) => ({
    next: onboarding ? { ...onboarding, sampleDirectoryId: directoryId } : null,
    result: undefined,
  }));
}

/** Takes one free starter document slot for this thread, if any is left. */
export async function claimStarterCourseDocument(
  userId: string,
  threadId: string,
): Promise<StarterDocumentClaimDecision> {
  return updateUserOnboarding(userId, (onboarding) => {
    const decision = decideStarterDocumentClaim({ onboarding, threadId });
    if (!decision.allowed || !onboarding) {
      return { next: null, result: decision };
    }
    return {
      next: {
        ...onboarding,
        starter: {
          ...onboarding.starter,
          documentsUsed: onboarding.starter.documentsUsed + 1,
        },
      },
      result: decision,
    };
  });
}

/** Gives a slot back when the document could not be queued. */
export async function releaseStarterCourseDocument(
  userId: string,
  threadId: string,
): Promise<void> {
  await updateUserOnboarding(userId, (onboarding) => {
    if (!onboarding || onboarding.starter.threadId !== threadId) {
      return { next: null, result: undefined };
    }
    return {
      next: {
        ...onboarding,
        starter: {
          ...onboarding.starter,
          documentsUsed: Math.max(0, onboarding.starter.documentsUsed - 1),
        },
      },
      result: undefined,
    };
  });
}

export async function recordStarterCourseDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  await updateUserOnboarding(userId, (onboarding) => {
    if (!onboarding || onboarding.starter.documentIds.includes(documentId)) {
      return { next: null, result: undefined };
    }
    return {
      next: {
        ...onboarding,
        starter: {
          ...onboarding.starter,
          documentIds: [...onboarding.starter.documentIds, documentId],
        },
      },
      result: undefined,
    };
  });
}

/** Records the course folder once; returns true when this call recorded it. */
export async function recordStarterCourseDirectory(
  userId: string,
  threadId: string,
  directoryId: string,
): Promise<boolean> {
  return updateUserOnboarding(userId, (onboarding) => {
    if (
      !onboarding ||
      onboarding.starter.threadId !== threadId ||
      onboarding.starter.directoryId
    ) {
      return { next: null, result: false };
    }
    return {
      next: {
        ...onboarding,
        starter: { ...onboarding.starter, directoryId },
      },
      result: true,
    };
  });
}

/** Claims the one starter quiz; false when it was already claimed. */
export async function claimStarterCourseQuiz(userId: string): Promise<boolean> {
  return updateUserOnboarding(userId, (onboarding) => {
    if (
      !onboarding ||
      onboarding.status !== 'started' ||
      onboarding.starter.quizClaimedAt
    ) {
      return { next: null, result: false };
    }
    return {
      next: {
        ...onboarding,
        starter: {
          ...onboarding.starter,
          quizClaimedAt: new Date().toISOString(),
        },
      },
      result: true,
    };
  });
}

/** Marks the starter course finished once its quiz is queued. */
export async function completeStarterCourse(
  userId: string,
  quizId: string | undefined,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await updateUserOnboarding(userId, (onboarding) => {
    if (!onboarding || onboarding.status !== 'started') {
      return { next: null, result: undefined };
    }
    return {
      next: {
        ...onboarding,
        status: 'completed',
        completedAt: nowIso,
        starter: {
          ...onboarding.starter,
          ...(quizId ? { quizId } : {}),
        },
      },
      result: undefined,
    };
  });
}
