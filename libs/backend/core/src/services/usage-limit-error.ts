import type { GenerationKind, UsageLimitErrorCode } from '@shared-types';

export class UsageLimitError extends Error {
  constructor(
    message: string,
    public readonly code: UsageLimitErrorCode | 'RESERVATION_NOT_FOUND' | 'RESERVATION_ALREADY_SETTLED',
    public readonly details?: {
      generationKind?: GenerationKind;
      remainingCredits?: number;
      resetAt?: string;
      creditCost?: number;
      storageUsedBytes?: number;
      storageLimitBytes?: number;
      remainingBytes?: number;
      dailySlideDecksUsed?: number;
      dailySlideDeckLimit?: number;
      dailySlideDecksRemaining?: number;
    },
  ) {
    super(message);
    this.name = 'UsageLimitError';
  }
}
