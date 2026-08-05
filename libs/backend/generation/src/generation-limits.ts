import { HttpsError } from 'firebase-functions/v2/https';
import type { GenerationKind } from '@shared-types';
import {
  commitUsageReservation,
  refundUsageReservation,
  reserveUsageCredits,
  UsageLimitError,
  type IUsageReservation,
} from '@study-forge/backend-core/services/usage-limits-service';
import {
  enforceCallableGenerationRateLimit,
  enforceExternalDualGenerationRateLimit,
} from './generation-rate-limit';

function toCallableUsageLimitError(error: UsageLimitError): HttpsError {
  return new HttpsError('resource-exhausted', error.message, {
    code: error.code,
    generationKind: error.details?.generationKind,
    remainingCredits: error.details?.remainingCredits,
    resetAt: error.details?.resetAt,
    creditCost: error.details?.creditCost,
  });
}

export async function enforceCallableGenerationLimits(
  userId: string,
  generationKind: GenerationKind | string,
  quantity?: number
): Promise<IUsageReservation> {
  await enforceCallableGenerationRateLimit(userId, generationKind);

  try {
    return await reserveUsageCredits({ userId, generationKind, quantity });
  } catch (error) {
    if (error instanceof UsageLimitError) {
      throw toCallableUsageLimitError(error);
    }
    throw error;
  }
}

export async function enforceExternalDualGenerationLimits(
  userId: string,
  apiKeyLimiterKey: string,
  generationKind: GenerationKind | string,
  quantity?: number
): Promise<IUsageReservation> {
  await enforceExternalDualGenerationRateLimit(userId, apiKeyLimiterKey, generationKind);

  try {
    return await reserveUsageCredits({ userId, generationKind, quantity });
  } catch (error) {
    if (error instanceof UsageLimitError) {
      throw toCallableUsageLimitError(error);
    }
    throw error;
  }
}

export async function withUsageReservation<T>(
  userId: string,
  generationKind: GenerationKind | string,
  quantity: number | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const reservation = await enforceCallableGenerationLimits(userId, generationKind, quantity);

  try {
    const result = await fn();
    await commitUsageReservation(userId, reservation.id);
    return result;
  } catch (error) {
    await refundUsageReservation(userId, reservation.id).catch(() => undefined);
    throw error;
  }
}

export async function reserveGenerationJobCredits(params: {
  userId: string;
  generationKind: GenerationKind | string;
  quantity?: number;
}): Promise<IUsageReservation> {
  return enforceCallableGenerationLimits(params.userId, params.generationKind, params.quantity);
}

export async function refundUsageReservationSafe(
  userId: string,
  reservationId?: string
): Promise<void> {
  if (!reservationId) {
    return;
  }

  await refundUsageReservation(userId, reservationId).catch(() => undefined);
}

export async function withExternalUsageReservation<T>(
  userId: string,
  apiKeyLimiterKey: string,
  generationKind: GenerationKind | string,
  quantity: number | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const reservation = await enforceExternalDualGenerationLimits(
    userId,
    apiKeyLimiterKey,
    generationKind,
    quantity
  );

  try {
    const result = await fn();
    await commitUsageReservation(userId, reservation.id);
    return result;
  } catch (error) {
    await refundUsageReservationSafe(userId, reservation.id);
    throw error;
  }
}
