import { HttpsError } from 'firebase-functions/v2/https';
import { GenerationKind } from '@shared-types';
import {
  enforceGenerationRateLimit,
  RateLimitError,
} from '../services/api-rate-limit';
import { resolveRateLimitGenerationKind } from '../services/generation-rate-limit-logic';

export function getCallableLimiterKey(userId: string): string {
  return `firebase_${userId}`;
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
  const resolvedKind = typeof generationKind === 'string'
    ? resolveRateLimitGenerationKind(generationKind)
    : generationKind;

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

export async function enforceExternalGenerationRateLimit(
  userId: string,
  limiterKey: string,
  generationKind: GenerationKind | string
): Promise<void> {
  const resolvedKind = typeof generationKind === 'string'
    ? resolveRateLimitGenerationKind(generationKind)
    : generationKind;

  await enforceGenerationRateLimit({
    userId,
    limiterKey,
    generationKind: resolvedKind,
  });
}
