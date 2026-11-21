import { describe, expect, it } from 'vitest';
import type { NarrationPart } from '@shared-types';
import {
  hasNewPlayableParts,
  joinedDurationMs,
  narrationTotalMs,
  partDurationMs,
  partIndexAtPosition,
  playableParts,
} from './narrationTimeline';

function part(
  index: number,
  status: NarrationPart['status'],
  durationMs?: number,
): NarrationPart {
  return {
    index,
    key: `k${index}`,
    blockStart: index * 2,
    blockEnd: index * 2 + 1,
    charCount: 1500,
    status,
    ...(status === 'ready'
      ? { storagePath: `p/${index}.mp3`, durationMs }
      : {}),
  };
}

describe('narration timeline', () => {
  const parts = [
    part(2, 'ready', 30_000),
    part(0, 'ready', 60_000),
    part(1, 'failed'),
    part(3, 'pending'),
  ];

  it('estimates parts without audio from their length', () => {
    expect(partDurationMs(part(3, 'pending'))).toBe(100_000);
    expect(partDurationMs(part(0, 'ready', 60_000))).toBe(60_000);
  });

  it('joins only ready parts, in document order', () => {
    const included = playableParts(parts);
    expect(included.map((entry) => entry.index)).toEqual([0, 2]);
    expect(joinedDurationMs(included)).toBe(90_000);
  });

  it('counts failed parts out of the total and estimates pending ones', () => {
    expect(narrationTotalMs(parts)).toBe(60_000 + 30_000 + 100_000);
  });

  it('finds the part being read at a position in the joined audio', () => {
    const included = playableParts(parts);
    expect(partIndexAtPosition(included, 0)).toBe(0);
    expect(partIndexAtPosition(included, 59_999)).toBe(0);
    expect(partIndexAtPosition(included, 60_000)).toBe(2);
    expect(partIndexAtPosition(included, 10_000_000)).toBe(2);
    expect(partIndexAtPosition([], 5)).toBeNull();
  });

  it('notices parts that became ready after a file was joined', () => {
    const joined = playableParts([part(0, 'ready', 1), part(1, 'ready', 1)]);
    expect(
      hasNewPlayableParts(joined, [part(0, 'ready', 1), part(1, 'ready', 1)]),
    ).toBe(false);
    expect(
      hasNewPlayableParts(joined, [
        part(0, 'ready', 1),
        part(1, 'ready', 1),
        part(2, 'ready', 1),
      ]),
    ).toBe(true);
  });
});
