import { HttpsError } from 'firebase-functions/v2/https';
import { GenerationKind } from '@shared-types';
import {
  enforceGenerationRateLimit,
  enforceGenerationRateLimitMultiBucket,
  RateLimitError,
} from '../services/api-rate-limit';
import { resolveRateLimitGenerationKind } from '../services/generation-rate-limit-logic';

export function getCallableLimiterKey(userId: string): string {
  return `firebase_${userId}`;
}

export function getExternalUserLimiterKey(userId: string): string {
  return `external_user_${userId}`;
}

function resolveGenerationKind(generationKind: GenerationKind | string): GenerationKind {
  return typeof generationKind === 'string'
    ? resolveRateLimitGenerationKind(generationKind)
    : generationKind;
}

export function toCallableRateLimitError(
  error: RateLimitError,
  generationKind: GenerationKind
): HttpsError {
  return new HttpsError('resource-exhausted', error.message, {
    retryAfterSeconds: error.retryAfterSeconds,
    generationKind: error.generationKind ?? generationKind,
  });
}

export async function enforceCallableGenerationRateLimit(
  userId: string,
  generationKind: GenerationKind | string
): Promise<void> {
  const resolvedKind = resolveGenerationKind(generationKind);

  try {
    await enforceGenerationRateLimit({
      userId,
      limiterKey: getCallableLimiterKey(userId),
      generationKind: resolvedKind,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw toCallableRateLimitError(error, resolvedKind);
    }
    throw error;
  }
}

export async function enforceJobGenerationRateLimit(
  userId: string,
  generationKind: GenerationKind | string
): Promise<void> {
  const resolvedKind = resolveGenerationKind(generationKind);

  await enforceGenerationRateLimit({
    userId,
    limiterKey: getCallableLimiterKey(userId),
    generationKind: resolvedKind,
  });
}

export async function enforceExternalDualGenerationRateLimit(
  userId: string,
  apiKeyLimiterKey: string,
  generationKind: GenerationKind | string
): Promise<void> {
  const resolvedKind = resolveGenerationKind(generationKind);

  await enforceGenerationRateLimitMultiBucket({
    userId,
    limiterKeys: [getExternalUserLimiterKey(userId), apiKeyLimiterKey],
    generationKind: resolvedKind,
  });
}

/** @deprecated Use enforceExternalDualGenerationRateLimit */
export async function enforceExternalGenerationRateLimit(
  userId: string,
  limiterKey: string,
  generationKind: GenerationKind | string
): Promise<void> {
  await enforceExternalDualGenerationRateLimit(userId, limiterKey, generationKind);
}
