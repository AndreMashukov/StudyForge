'use client';

import { z } from 'zod';

export const adminMutationResultSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
});

export type IAdminMutationResult = z.infer<typeof adminMutationResultSchema>;

const adminSessionResponseSchema = z.object({
  message: z.string().optional(),
});

export type IAdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function requestJson(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; payload: unknown }> {
  const response = await fetch(path, init);
  const payload = await readJsonBody(response);
  return { response, payload };
}

export async function requestJsonValidated<TResponse>(
  path: string,
  schema: z.ZodType<TResponse>,
  init?: RequestInit
): Promise<{ response: Response; payload: TResponse }> {
  const { response, payload } = await requestJson(path, init);
  return { response, payload: schema.parse(payload) };
}

export async function requestMutation(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; payload: IAdminMutationResult }> {
  return requestJsonValidated(path, adminMutationResultSchema, init);
}

export async function requestSessionMutation(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; payload: IAdminSessionResponse }> {
  return requestJsonValidated(path, adminSessionResponseSchema, init);
}
