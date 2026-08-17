import { HttpsError } from 'firebase-functions/v2/https';
import type { GenerationKind } from '@shared-types';
import {
  buildProviderCostContext,
  runWithProviderCostContext,
} from '@study-forge/backend-core/services/provider-cost';
import {
  commitUsageReservation,
  refundUsageReservation,
  reserveUsageCredits,
  resolveUserUsageLimitsContext,
  UsageLimitError,
  type IUsageReservation,
} from '@study-forge/backend-core/services/usage-limits-service';
import {
  refundDailySlideDeckReservation,
  refundDailySlideDeckReservationSafe,
  reserveDailySlideDeckSlot,
  type IDailySlideDeckReservation,
} from '@study-forge/backend-core/services/usage-quota-service';
import {
  enforceCallableGenerationRateLimit,
  enforceExternalDualGenerationRateLimit,
} from './generation-rate-limit';

export interface ISlideDeckGenerationReservations {
  usageReservation: IUsageReservation;
  dailySlideDeckReservation: IDailySlideDeckReservation;
}

function toCallableUsageLimitError(error: UsageLimitError): HttpsError {
  return new HttpsError('resource-exhausted', error.message, {
    code: error.code,
    generationKind: error.details?.generationKind,
    remainingCredits: error.details?.remainingCredits,
    resetAt: error.details?.resetAt,
    creditCost: error.details?.creditCost,
    storageUsedBytes: error.details?.storageUsedBytes,
    storageLimitBytes: error.details?.storageLimitBytes,
    remainingBytes: error.details?.remainingBytes,
    dailySlideDecksUsed: error.details?.dailySlideDecksUsed,
    dailySlideDeckLimit: error.details?.dailySlideDeckLimit,
    dailySlideDecksRemaining: error.details?.dailySlideDecksRemaining,
  });
}

export async function enforceCallableSlideDeckGenerationLimits(
  userId: string,
): Promise<ISlideDeckGenerationReservations> {
  await enforceCallableGenerationRateLimit(userId, 'slideDeck');

  try {
    const context = await resolveUserUsageLimitsContext(userId);
    const dailySlideDeckReservation = await reserveDailySlideDeckSlot(context);
    try {
      const usageReservation = await reserveUsageCredits({ userId, generationKind: 'slideDeck' });
      return { usageReservation, dailySlideDeckReservation };
    } catch (error) {
      await refundDailySlideDeckReservation(userId, dailySlideDeckReservation.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof UsageLimitError) {
      throw toCallableUsageLimitError(error);
    }
    throw error;
  }
}

export async function enforceExternalSlideDeckGenerationLimits(params: {
  userId: string;
  apiKeyLimiterKey: string;
}): Promise<ISlideDeckGenerationReservations> {
  await enforceExternalDualGenerationRateLimit(params.userId, params.apiKeyLimiterKey, 'slideDeck');

  try {
    const context = await resolveUserUsageLimitsContext(params.userId);
    const dailySlideDeckReservation = await reserveDailySlideDeckSlot(context);
    try {
      const usageReservation = await reserveUsageCredits({
        userId: params.userId,
        generationKind: 'slideDeck',
      });
      return { usageReservation, dailySlideDeckReservation };
    } catch (error) {
      await refundDailySlideDeckReservation(params.userId, dailySlideDeckReservation.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof UsageLimitError) {
      throw toCallableUsageLimitError(error);
    }
    throw error;
  }
}

export async function refundSlideDeckGenerationReservationsSafe(params: {
  userId: string;
  usageReservationId?: string;
  dailySlideDeckReservationId?: string;
}): Promise<void> {
  await refundUsageReservationSafe(params.userId, params.usageReservationId);
  await refundDailySlideDeckReservationSafe(params.userId, params.dailySlideDeckReservationId);
}

export async function reserveExternalDailySlideDeckSlot(
  userId: string,
): Promise<IDailySlideDeckReservation> {
  const context = await resolveUserUsageLimitsContext(userId);
  return reserveDailySlideDeckSlot(context);
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
  const context = buildProviderCostContext({
    userId,
    generationKind: reservation.generationKind,
    reservationId: reservation.id,
    llmSetupId: reservation.llmSetupId,
    userGroupId: reservation.userGroupId,
    periodKey: reservation.periodKey,
  });

  try {
    const result = await runWithProviderCostContext(context, fn);
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
  const context = buildProviderCostContext({
    userId,
    generationKind: reservation.generationKind,
    reservationId: reservation.id,
    llmSetupId: reservation.llmSetupId,
    userGroupId: reservation.userGroupId,
    periodKey: reservation.periodKey,
  });

  try {
    const result = await runWithProviderCostContext(context, fn);
    await commitUsageReservation(userId, reservation.id);
    return result;
  } catch (error) {
    await refundUsageReservationSafe(userId, reservation.id);
    throw error;
  }
}
