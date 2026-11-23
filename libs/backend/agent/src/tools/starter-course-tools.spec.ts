import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  isStarterCourseToolAvailable,
  readShortCooldownSeconds,
  resolveStarterCoursePhase,
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

describe('resolveStarterCoursePhase', () => {
  it('asks on the first starter turn', () => {
    expect(
      resolveStarterCoursePhase({ turnsUsed: 1, documentsUsed: 0 }),
    ).toBe('ask');
  });

  it('builds once the user answered or work already exists', () => {
    expect(resolveStarterCoursePhase({ turnsUsed: 2, documentsUsed: 0 })).toBe(
      'build',
    );
    expect(
      resolveStarterCoursePhase({
        turnsUsed: 1,
        documentsUsed: 0,
        directoryId: 'course-dir',
      }),
    ).toBe('build');
  });
});

describe('isStarterCourseToolAvailable', () => {
  it('hides folder and document tools while asking', () => {
    expect(isStarterCourseToolAvailable('create_document', 'ask')).toBe(false);
    expect(isStarterCourseToolAvailable('create_directory', 'ask')).toBe(false);
    expect(isStarterCourseToolAvailable('create_document', 'build')).toBe(true);
    expect(isStarterCourseToolAvailable('generate_quiz', 'build')).toBe(false);
    expect(isStarterCourseToolAvailable('list_directories', 'ask')).toBe(true);
  });
});
