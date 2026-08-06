'use client';

import { requestJson } from './client';

export async function createAdminSession(idToken: string): Promise<Response> {
  const { response } = await requestJson<{ message?: string }>('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  return response;
}

export async function deleteAdminSession(): Promise<Response> {
  const { response } = await requestJson<{ success?: boolean }>('/api/auth/session', {
    method: 'DELETE',
  });
  return response;
}
