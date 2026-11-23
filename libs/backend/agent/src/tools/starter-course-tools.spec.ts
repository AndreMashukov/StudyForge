import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  readShortCooldownSeconds,
  STARTER_COOLDOWN_MAX_WAIT_SECONDS,
  waitForCooldown,
} from './starter-course-tools';

describe('readShortCooldownSeconds', () => {
  it('reads a short cooldown from a rate-limit error', () => {
    expect(
      readShortCooldownSeconds(
        new HttpsError('resource-exhausted', 'Slow down', {
          retryAfterSeconds: 9,
        }),
      ),
    ).toBe(9);
  });

  it('ignores long waits, other codes and other errors', () => {
    expect(
      readShortCooldownSeconds(
        new HttpsError('resource-exhausted', 'Hourly limit', {
          retryAfterSeconds: STARTER_COOLDOWN_MAX_WAIT_SECONDS + 1,
        }),
      ),
    ).toBeUndefined();
    expect(
      readShortCooldownSeconds(
        new HttpsError('failed-precondition', 'No credits', {
          retryAfterSeconds: 5,
        }),
      ),
    ).toBeUndefined();
    expect(readShortCooldownSeconds(new Error('boom'))).toBeUndefined();
  });
});

describe('waitForCooldown', () => {
  it('stops waiting when the turn is aborted', async () => {
    const controller = new AbortController();
    const waiting = waitForCooldown(10, controller.signal);
    controller.abort('cancel');
    await expect(waiting).rejects.toThrow('Aborted');
  });
});
