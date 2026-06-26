import 'server-only';

import { IAdminUserSummary } from '../../types/IAdminUserSummary';
import { requireAdminSession } from '../auth/session';
import { getAdminAuth, getAdminFirestore } from '../firebase/admin';

export interface IListUsersOptions {
  limit?: number;
}

function toIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

async function resolveGroupName(userGroupId?: string): Promise<string | undefined> {
  if (!userGroupId) {
    return undefined;
  }

  const doc = await getAdminFirestore().collection('userGroups').doc(userGroupId).get();
  const name = doc.data()?.name;
  return typeof name === 'string' ? name : undefined;
}

function mapUserSummary(
  uid: string,
  authEmail: string | undefined,
  authDisplayName: string | undefined,
  authCreatedAt: string | undefined,
  disabled: boolean,
  firestoreData: FirebaseFirestore.DocumentData | undefined
): IAdminUserSummary {
  const userGroupId =
    typeof firestoreData?.userGroupId === 'string'
      ? firestoreData.userGroupId.trim()
      : undefined;

  return {
    uid,
    email: authEmail || (typeof firestoreData?.email === 'string' ? firestoreData.email : 'unknown'),
    displayName: authDisplayName || (typeof firestoreData?.displayName === 'string' ? firestoreData.displayName : undefined),
    createdAt: toIsoString(firestoreData?.createdAt) || authCreatedAt,
    disabled,
    userGroupId: userGroupId || undefined,
  };
}

export async function listUsers(
  options: IListUsersOptions = {}
): Promise<IAdminUserSummary[]> {
  await requireAdminSession();

  const limit = Math.min(options.limit ?? 50, 100);
  const auth = getAdminAuth();
  const db = getAdminFirestore();

  const listResult = await auth.listUsers(limit);
  const summaries: IAdminUserSummary[] = [];

  for (const user of listResult.users) {
    const doc = await db.collection('users').doc(user.uid).get();
    const summary = mapUserSummary(
      user.uid,
      user.email,
      user.displayName,
      user.metadata.creationTime,
      user.disabled,
      doc.data()
    );

    summary.userGroupName = await resolveGroupName(summary.userGroupId);
    summaries.push(summary);
  }

  return summaries;
}

export async function getUserById(userId: string): Promise<IAdminUserSummary | null> {
  await requireAdminSession();

  const auth = getAdminAuth();
  const db = getAdminFirestore();

  try {
    const user = await auth.getUser(userId);
    const doc = await db.collection('users').doc(userId).get();
    const summary = mapUserSummary(
      user.uid,
      user.email,
      user.displayName,
      user.metadata.creationTime,
      user.disabled,
      doc.data()
    );

    summary.userGroupName = await resolveGroupName(summary.userGroupId);
    return summary;
  } catch {
    return null;
  }
}

export async function assignUserGroup(
  userId: string,
  userGroupId: string,
  adminUid: string
): Promise<IAdminUserSummary> {
  await requireAdminSession();

  const group = await getAdminFirestore().collection('userGroups').doc(userGroupId).get();
  if (!group.exists) {
    throw new Error('User group not found.');
  }

  const auth = getAdminAuth();
  const db = getAdminFirestore();

  await auth.getUser(userId);

  await db.collection('users').doc(userId).set(
    {
      userGroupId,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    },
    { merge: true }
  );

  const updated = await getUserById(userId);
  if (!updated) {
    throw new Error('Failed to load updated user.');
  }

  return updated;
}

export async function countUsersInGroup(groupId: string): Promise<number> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection('users')
    .where('userGroupId', '==', groupId)
    .get();

  return snapshot.size;
}
