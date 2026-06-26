import 'server-only';

import type { ICreateUserGroupRequest, IUpdateUserGroupRequest, IUserGroup } from '@shared-types';
import { requireAdminSession } from '../auth/session';
import { getAdminFirestore } from '../firebase/admin';
import { ensureSetupExists } from './llm-setups';

const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';

export interface IAdminUserGroupSummary extends IUserGroup {
  memberCount: number;
  llmSetupName?: string;
}

function parseUserGroup(id: string, data: FirebaseFirestore.DocumentData): IUserGroup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const llmSetupId = typeof data.llmSetupId === 'string' ? data.llmSetupId.trim() : '';

  if (!name || !llmSetupId) {
    return null;
  }

  return {
    id,
    name,
    llmSetupId,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

async function countMembersForGroup(groupId: string): Promise<number> {
  const snapshot = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .where('userGroupId', '==', groupId)
    .get();

  return snapshot.size;
}

async function getSetupName(setupId: string): Promise<string | undefined> {
  const doc = await getAdminFirestore().collection('llmSetups').doc(setupId).get();
  const name = doc.data()?.name;
  return typeof name === 'string' ? name : undefined;
}

export async function listUserGroups(): Promise<IAdminUserGroupSummary[]> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore().collection(USER_GROUPS_COLLECTION).get();

  const summaries: IAdminUserGroupSummary[] = [];

  for (const doc of snapshot.docs) {
    const group = parseUserGroup(doc.id, doc.data());
    if (!group) {
      continue;
    }

    summaries.push({
      ...group,
      memberCount: await countMembersForGroup(doc.id),
      llmSetupName: await getSetupName(group.llmSetupId),
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserGroupById(groupId: string): Promise<IAdminUserGroupSummary | null> {
  await requireAdminSession();

  const doc = await getAdminFirestore().collection(USER_GROUPS_COLLECTION).doc(groupId).get();
  if (!doc.exists) {
    return null;
  }

  const group = parseUserGroup(doc.id, doc.data() ?? {});
  if (!group) {
    return null;
  }

  return {
    ...group,
    memberCount: await countMembersForGroup(doc.id),
    llmSetupName: await getSetupName(group.llmSetupId),
  };
}

export async function createUserGroup(
  input: ICreateUserGroupRequest,
  adminUid: string
): Promise<IUserGroup> {
  await requireAdminSession();

  const name = input.name.trim();
  const llmSetupId = input.llmSetupId.trim();

  if (!name) {
    throw new Error('Group name is required.');
  }

  if (!llmSetupId) {
    throw new Error('LLM setup is required.');
  }

  await ensureSetupExists(llmSetupId);

  const now = new Date().toISOString();
  const docRef = getAdminFirestore().collection(USER_GROUPS_COLLECTION).doc();

  const group: IUserGroup = {
    id: docRef.id,
    name,
    llmSetupId,
    updatedAt: now,
    updatedBy: adminUid,
  };

  await docRef.set(group);
  return group;
}

export async function updateUserGroup(
  groupId: string,
  input: IUpdateUserGroupRequest,
  adminUid: string
): Promise<IUserGroup> {
  await requireAdminSession();

  const docRef = getAdminFirestore().collection(USER_GROUPS_COLLECTION).doc(groupId);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error('User group not found.');
  }

  const current = parseUserGroup(existing.id, existing.data() ?? {});
  if (!current) {
    throw new Error('User group data is invalid.');
  }

  const llmSetupId = input.llmSetupId?.trim() || current.llmSetupId;
  await ensureSetupExists(llmSetupId);

  const next: IUserGroup = {
    ...current,
    name: input.name?.trim() || current.name,
    llmSetupId,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };

  if (!next.name.trim()) {
    throw new Error('Group name is required.');
  }

  await docRef.set(next, { merge: true });
  return next;
}

export async function deleteUserGroup(groupId: string): Promise<void> {
  await requireAdminSession();

  const membersSnapshot = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .where('userGroupId', '==', groupId)
    .limit(5)
    .get();

  if (!membersSnapshot.empty) {
    throw new Error(
      'Cannot delete group because users are still assigned. Reassign those users first.'
    );
  }

  await getAdminFirestore().collection(USER_GROUPS_COLLECTION).doc(groupId).delete();
}

export async function listUserGroupOptions(): Promise<Array<{ id: string; name: string }>> {
  const groups = await listUserGroups();
  return groups.map(({ id, name }) => ({ id, name }));
}

export async function listGroupMembers(groupId: string): Promise<Array<{ uid: string; email: string }>> {
  await requireAdminSession();

  const snapshot = await getAdminFirestore()
    .collection(USERS_COLLECTION)
    .where('userGroupId', '==', groupId)
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    email: typeof doc.data().email === 'string' ? doc.data().email : doc.id,
  }));
}
