import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { GenerationKind } from '@shared-types';
import { getGenerationRateLimitProfile } from './generation-rate-limit-profiles';
import {
  buildRateLimitDocId,
  evaluateMultiBucketRateLimitStates,
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

export interface MultiBucketGenerationRateLimitParams {
  userId: string;
  limiterKeys: string[];
  generationKind: GenerationKind;
}

/** @deprecated Use enforceGenerationRateLimit with generationKind documentFromScreenshot */
export interface ScreenshotRateLimitParams {
  userId: string;
  limiterKey: string;
}

function uniqueLimiterKeys(limiterKeys: string[]): string[] {
  return [...new Set(limiterKeys)];
}

export async function enforceGenerationRateLimitMultiBucket({
  userId,
  limiterKeys,
  generationKind,
}: MultiBucketGenerationRateLimitParams): Promise<void> {
  const keys = uniqueLimiterKeys(limiterKeys);
  if (keys.length === 0) {
    return;
  }

  const db = getFirestore();
  const profile = getGenerationRateLimitProfile(generationKind);
  const refs = keys.map((limiterKey) => ({
    limiterKey,
    ref: db
      .collection('users')
      .doc(userId)
      .collection('apiRateLimits')
      .doc(buildRateLimitDocId(generationKind, limiterKey)),
  }));

  await db.runTransaction(async (transaction) => {
    const now = Date.now();
    const snapshots = await Promise.all(refs.map(({ ref }) => transaction.get(ref)));
    const states = snapshots.map((snapshot) => snapshot.data() as IRateLimitState | undefined);
    const decision = evaluateMultiBucketRateLimitStates(states, profile, now);

    if (decision.allowed === false) {
      throw new RateLimitError(
        decision.message,
        decision.retryAfterSeconds,
        generationKind
      );
    }

    refs.forEach(({ limiterKey, ref }, index) => {
      const nextState = decision.nextStates[index];
      transaction.set(
        ref,
        {
          limiterKey,
          generationKind,
          lastRequestAtMs: nextState.lastRequestAtMs,
          windowStartAtMs: nextState.windowStartAtMs,
          requestCount: nextState.requestCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  });
}

export async function enforceGenerationRateLimit({
  userId,
  limiterKey,
  generationKind,
}: GenerationRateLimitParams): Promise<void> {
  await enforceGenerationRateLimitMultiBucket({
    userId,
    limiterKeys: [limiterKey],
    generationKind,
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
