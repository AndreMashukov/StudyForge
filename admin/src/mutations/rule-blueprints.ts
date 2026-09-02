'use client';

import { z } from 'zod';
import type {
  ICreateRuleBlueprintRequest,
  IUpdateRuleBlueprintRequest,
} from '@shared-types';
import { requestJsonValidated } from './client';

const ruleBlueprintMutationSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  blueprint: z
    .object({
      id: z.string(),
    })
    .optional(),
});

export async function saveRuleBlueprint(
  blueprintId: string | undefined,
  payload: ICreateRuleBlueprintRequest | IUpdateRuleBlueprintRequest,
) {
  return requestJsonValidated(
    blueprintId ? `/api/rule-blueprints/${blueprintId}` : '/api/rule-blueprints',
    ruleBlueprintMutationSchema,
    {
      method: blueprintId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function publishRuleBlueprint(blueprintId: string) {
  return requestJsonValidated(
    `/api/rule-blueprints/${blueprintId}/publish`,
    ruleBlueprintMutationSchema,
    { method: 'POST' },
  );
}

export async function archiveRuleBlueprint(blueprintId: string) {
  return requestJsonValidated(
    `/api/rule-blueprints/${blueprintId}/archive`,
    ruleBlueprintMutationSchema,
    { method: 'POST' },
  );
}

export async function deleteRuleBlueprint(blueprintId: string) {
  return requestJsonValidated(
    `/api/rule-blueprints/${blueprintId}`,
    ruleBlueprintMutationSchema,
    { method: 'DELETE' },
  );
}
