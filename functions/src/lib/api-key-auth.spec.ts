import { describe, expect, it } from 'vitest';
import {
  isLastUsedAtUpdateDue,
  LAST_USED_AT_UPDATE_INTERVAL_MS,
} from './api-key-auth';

describe('isLastUsedAtUpdateDue', () => {
  const nowMs = 1_000_000;

  it('returns true when lastUsedAt is missing', () => {
    expect(isLastUsedAtUpdateDue(null, nowMs)).toBe(true);
    expect(isLastUsedAtUpdateDue(undefined, nowMs)).toBe(true);
  });

  it('returns true when lastUsedAt is older than the update interval', () => {
    const staleDate = new Date(nowMs - LAST_USED_AT_UPDATE_INTERVAL_MS);
    expect(isLastUsedAtUpdateDue(staleDate, nowMs)).toBe(true);
  });

  it('returns false when lastUsedAt is within the update interval', () => {
    const recentDate = new Date(nowMs - LAST_USED_AT_UPDATE_INTERVAL_MS + 1_000);
    expect(isLastUsedAtUpdateDue(recentDate, nowMs)).toBe(false);
  });

  it('supports Firestore Timestamp-like values', () => {
    const recentTimestamp = {
      toDate: () => new Date(nowMs - 5_000),
    };

    expect(isLastUsedAtUpdateDue(recentTimestamp, nowMs)).toBe(false);
  });
});
