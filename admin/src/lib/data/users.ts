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
    const data = doc.data();

    summaries.push({
      uid: user.uid,
      email: user.email || data?.email || 'unknown',
      displayName: user.displayName || data?.displayName,
      createdAt: toIsoString(data?.createdAt) || user.metadata.creationTime,
      disabled: user.disabled,
    });
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
    const data = doc.data();

    return {
      uid: user.uid,
      email: user.email || data?.email || 'unknown',
      displayName: user.displayName || data?.displayName,
      createdAt: toIsoString(data?.createdAt) || user.metadata.creationTime,
      disabled: user.disabled,
    };
  } catch {
    return null;
  }
}
