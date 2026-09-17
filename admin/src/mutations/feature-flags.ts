'use client';

import type { IUpdateFeatureFlagsRequest } from '@shared-types';
import { requestJson } from './client';

export async function saveFeatureFlags(payload: IUpdateFeatureFlagsRequest) {
  return requestJson('/api/feature-flags', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
