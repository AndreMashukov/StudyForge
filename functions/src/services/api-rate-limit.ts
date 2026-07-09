import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { GenerationKind } from '@shared-types';
import { getGenerationRateLimitProfile } from './generation-rate-limit-profiles';
import {
  buildRateLimitDocId,
  evaluateRateLimitState,
  IRateLimitState,
} from './generation-rate-limit-logic';

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly generationKind?: GenerationKind
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface GenerationRateLimitParams {
  userId: string;
  limiterKey: string;
  generationKind: GenerationKind;
}

/** @deprecated Use enforceGenerationRateLimit with generationKind documentFromScreenshot */
export interface ScreenshotRateLimitParams {
  userId: string;
  limiterKey: string;
}

export async function enforceGenerationRateLimit({
  userId,
  limiterKey,
  generationKind,
}: GenerationRateLimitParams): Promise<void> {
  const db = getFirestore();
  const profile = getGenerationRateLimitProfile(generationKind);
  const ref = db
    .collection('users')
    .doc(userId)
    .collection('apiRateLimits')
    .doc(buildRateLimitDocId(generationKind, limiterKey));

  await db.runTransaction(async (transaction) => {
    const now = Date.now();
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as IRateLimitState | undefined;
    const decision = evaluateRateLimitState(data, profile, now);

    if (decision.allowed === false) {
      throw new RateLimitError(
        decision.message,
        decision.retryAfterSeconds,
        generationKind
      );
    }

    transaction.set(
      ref,
      {
        limiterKey,
        generationKind,
        lastRequestAtMs: decision.nextState.lastRequestAtMs,
        windowStartAtMs: decision.nextState.windowStartAtMs,
        requestCount: decision.nextState.requestCount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function enforceScreenshotGenerationRateLimit({
  userId,
  limiterKey,
}: ScreenshotRateLimitParams): Promise<void> {
  await enforceGenerationRateLimit({
    userId,
    limiterKey,
    generationKind: 'documentFromScreenshot',
  });
}
