import {
  buildUsageDayResetAt,
  calculateDailySlideDecksUsed,
  calculateRemainingDailySlideDecks,
  calculateRemainingStorageBytes,
} from '@shared-types';

export interface IUsageDailySlideDeckState {
  reservedSlideDecks: number;
  completedSlideDecks: number;
  refundedSlideDecks: number;
}

export type StorageQuotaDecision =
  | { allowed: true; remainingBytes: number }
  | {
      allowed: false;
      code: 'STORAGE_LIMIT_EXCEEDED';
      message: string;
      usedBytes: number;
      limitBytes: number;
      remainingBytes: number;
      requestedBytes: number;
    };

export type DailySlideDeckQuotaDecision =
  | { allowed: true; remaining: number; resetAt: string }
  | {
      allowed: false;
      code: 'DAILY_SLIDE_DECK_LIMIT_EXCEEDED';
      message: string;
      used: number;
      limit: number;
      remaining: number;
      resetAt: string;
    };

export function evaluateStorageQuotaDecision(params: {
  limitBytes: number;
  usedBytes: number;
  requestedBytes: number;
}): StorageQuotaDecision {
  const remainingBytes = calculateRemainingStorageBytes({
    limitBytes: params.limitBytes,
    usedBytes: params.usedBytes,
  });

  if (params.requestedBytes <= remainingBytes) {
    return { allowed: true, remainingBytes };
  }

  return {
    allowed: false,
    code: 'STORAGE_LIMIT_EXCEEDED',
    message: 'Storage limit reached. Delete content before uploading or generating more files.',
    usedBytes: params.usedBytes,
    limitBytes: params.limitBytes,
    remainingBytes,
    requestedBytes: params.requestedBytes,
  };
}

export function evaluateDailySlideDeckQuotaDecision(params: {
  limit: number;
  dayKey: string;
  state: IUsageDailySlideDeckState;
}): DailySlideDeckQuotaDecision {
  const resetAt = buildUsageDayResetAt(params.dayKey);
  const used = calculateDailySlideDecksUsed({
    reservedSlideDecks: params.state.reservedSlideDecks,
    completedSlideDecks: params.state.completedSlideDecks,
  });
  const remaining = calculateRemainingDailySlideDecks({
    limit: params.limit,
    reservedSlideDecks: params.state.reservedSlideDecks,
    completedSlideDecks: params.state.completedSlideDecks,
  });

  if (remaining > 0) {
    return { allowed: true, remaining, resetAt };
  }

  return {
    allowed: false,
    code: 'DAILY_SLIDE_DECK_LIMIT_EXCEEDED',
    message: 'Daily slide deck generation limit reached. Try again after the daily reset.',
    used,
    limit: params.limit,
    remaining: 0,
    resetAt,
  };
}

export function readDailySlideDeckState(data: Record<string, unknown>): IUsageDailySlideDeckState {
  return {
    reservedSlideDecks:
      typeof data.reservedSlideDecks === 'number' ? data.reservedSlideDecks : 0,
    completedSlideDecks:
      typeof data.completedSlideDecks === 'number' ? data.completedSlideDecks : 0,
    refundedSlideDecks:
      typeof data.refundedSlideDecks === 'number' ? data.refundedSlideDecks : 0,
  };
}
