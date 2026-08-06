'use client';

export interface IAdminMutationResult {
  success?: boolean;
  message?: string;
}

export async function requestJson<TResponse>(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; payload: TResponse }> {
  const response = await fetch(path, init);
  const payload = (await response.json()) as TResponse;
  return { response, payload };
}

export async function requestMutation<TResponse extends IAdminMutationResult>(
  path: string,
  init?: RequestInit
): Promise<{ response: Response; payload: TResponse }> {
  return requestJson<TResponse>(path, init);
}
