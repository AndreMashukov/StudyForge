'use client';

import { requestMutation } from './client';

export async function assignUserGroup(userId: string, userGroupId: string) {
  return requestMutation(
    `/api/users/${userId}/group`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userGroupId }),
    }
  );
}
