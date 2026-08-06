'use client';

import type { ICreateLlmSetupRequest, IUpdateLlmSetupRequest } from '@shared-types';
import { requestMutation } from './client';

export async function saveLlmSetup(
  setupId: string | undefined,
  payload: ICreateLlmSetupRequest | IUpdateLlmSetupRequest
) {
  return requestMutation(
    setupId ? `/api/llm-setups/${setupId}` : '/api/llm-setups',
    {
      method: setupId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteLlmSetup(setupId: string) {
  return requestMutation(
    `/api/llm-setups/${setupId}`,
    { method: 'DELETE' }
  );
}
