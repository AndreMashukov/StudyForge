'use client';

import type {
  ICreateUsageLimitsSetupRequest,
  IUpdateUsageLimitsSetupRequest,
} from '@shared-types';
import { requestMutation } from './client';

export async function saveUsageLimitsSetup(
  setupId: string | undefined,
  payload: ICreateUsageLimitsSetupRequest | IUpdateUsageLimitsSetupRequest
) {
  return requestMutation<{ success?: boolean; message?: string }>(
    setupId ? `/api/usage-limits-setups/${setupId}` : '/api/usage-limits-setups',
    {
      method: setupId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteUsageLimitsSetup(setupId: string) {
  return requestMutation<{ success?: boolean; message?: string }>(
    `/api/usage-limits-setups/${setupId}`,
    { method: 'DELETE' }
  );
}
