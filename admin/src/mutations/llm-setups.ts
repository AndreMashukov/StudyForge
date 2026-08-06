'use client';

import type { ICreateLlmSetupRequest, IUpdateLlmSetupRequest } from '@shared-types';
import { requestMutation } from './client';

export async function saveLlmSetup(
  setupId: string | undefined,
  payload: ICreateLlmSetupRequest | IUpdateLlmSetupRequest
) {
  return requestMutation<{ success?: boolean; message?: string }>(
    setupId ? `/api/llm-setups/${setupId}` : '/api/llm-setups',
    {
      method: setupId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteLlmSetup(setupId: string) {
  return requestMutation<{ success?: boolean; message?: string }>(
    `/api/llm-setups/${setupId}`,
    { method: 'DELETE' }
  );
}
