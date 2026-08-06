'use client';

import { z } from 'zod';
import { requestJsonValidated, requestSessionMutation } from './client';

const adminDeleteSessionSchema = z.object({
  success: z.boolean().optional(),
});

export async function createAdminSession(idToken: string) {
  return requestSessionMutation('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

export async function deleteAdminSession() {
  return requestJsonValidated('/api/auth/session', adminDeleteSessionSchema, {
    method: 'DELETE',
  });
}
