'use client';

import { requestMutation } from './client';

export interface IUserGroupMutationPayload {
  name: string;
  llmSetupId: string;
  usageLimitsSetupId: string;
}

export async function saveUserGroup(
  groupId: string | undefined,
  payload: IUserGroupMutationPayload
) {
  return requestMutation(
    groupId ? `/api/user-groups/${groupId}` : '/api/user-groups',
    {
      method: groupId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteUserGroup(groupId: string) {
  return requestMutation(
    `/api/user-groups/${groupId}`,
    { method: 'DELETE' }
  );
}
