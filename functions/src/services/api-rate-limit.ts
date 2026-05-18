import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const SCREENSHOT_COOLDOWN_MS = 15_000;
const SCREENSHOT_HOURLY_LIMIT = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface ScreenshotRateLimitParams {
  userId: string;
  limiterKey: string;
}

interface RateLimitState {
  lastRequestAtMs?: number;
  windowStartAtMs?: number;
  requestCount?: number;
}

export async function enforceScreenshotGenerationRateLimit({
  userId,
  limiterKey,
}: ScreenshotRateLimitParams): Promise<void> {
  const db = getFirestore();
  const normalizedLimiterKey = limiterKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ref = db
    .collection('users')
    .doc(userId)
    .collection('apiRateLimits')
    .doc(`screenshot_${normalizedLimiterKey}`);

  await db.runTransaction(async (transaction) => {
    const now = Date.now();
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as RateLimitState | undefined;

    const lastRequestAtMs = data?.lastRequestAtMs || 0;
    const cooldownRemainingMs = SCREENSHOT_COOLDOWN_MS - (now - lastRequestAtMs);
    if (lastRequestAtMs > 0 && cooldownRemainingMs > 0) {
      throw new RateLimitError(
        'Screenshot capture is cooling down. Try again in a few seconds.',
        Math.ceil(cooldownRemainingMs / 1000)
      );
    }

    const windowStartAtMs = data?.windowStartAtMs || now;
    const isCurrentWindow = now - windowStartAtMs < ONE_HOUR_MS;
    const requestCount = isCurrentWindow ? data?.requestCount || 0 : 0;

    if (requestCount >= SCREENSHOT_HOURLY_LIMIT) {
      const retryAfterMs = ONE_HOUR_MS - (now - windowStartAtMs);
      throw new RateLimitError(
        'Screenshot capture hourly limit reached. Try again later.',
        Math.max(1, Math.ceil(retryAfterMs / 1000))
      );
    }

    transaction.set(
      ref,
      {
        limiterKey,
        lastRequestAtMs: now,
        windowStartAtMs: isCurrentWindow ? windowStartAtMs : now,
        requestCount: requestCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}