'use client';

import type { IUpdateLlmGenerationSettingsRequest } from '@shared-types';
import { requestJson } from './client';

export async function saveLlmGenerationSettings(
  payload: IUpdateLlmGenerationSettingsRequest
) {
  return requestJson('/api/llm-generation-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
