import { describe, expect, it } from 'vitest';
import type { NarrationPart } from '@shared-types';
import {
  firstUnheardOffsetMs,
  hasNewPlayableParts,
  isNarrationComplete,
  mapPositionMs,
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

  it('carries on at the first part not heard, even when it comes earlier', () => {
    const heard = playableParts([
      part(0, 'ready', 60_000),
      part(2, 'ready', 30_000),
    ]);
    const next = playableParts([
      part(0, 'ready', 60_000),
      part(1, 'ready', 40_000),
      part(2, 'ready', 30_000),
      part(3, 'ready', 10_000),
    ]);
    expect(firstUnheardOffsetMs(heard, next)).toBe(60_000);
    expect(firstUnheardOffsetMs(next, next)).toBeNull();
    expect(
      firstUnheardOffsetMs(playableParts([part(0, 'ready', 60_000)]), heard),
    ).toBe(60_000);
  });

  it('maps a position to the same place when parts are added before it', () => {
    const before = playableParts([
      part(0, 'ready', 60_000),
      part(2, 'ready', 30_000),
    ]);
    const after = playableParts([
      part(0, 'ready', 60_000),
      part(1, 'ready', 40_000),
      part(2, 'ready', 30_000),
    ]);
    // 10 s into part 0 stays there; 10 s into part 2 moves past the new part 1.
    expect(mapPositionMs(before, after, 10_000)).toBe(10_000);
    expect(mapPositionMs(before, after, 70_000)).toBe(110_000);
    // At the end of the old file: the first part not yet in it.
    expect(mapPositionMs(before, after, 90_000)).toBe(60_000);
    // A part that is gone: the start of the next one after it.
    expect(
      mapPositionMs(
        after,
        playableParts([part(0, 'ready', 60_000), part(2, 'ready', 30_000)]),
        70_000,
      ),
    ).toBe(60_000);
  });

  it('is complete only when every part that will play is in the file', () => {
    const joined = playableParts([part(0, 'ready', 1), part(2, 'ready', 1)]);
    expect(
      isNarrationComplete(joined, [
        part(0, 'ready', 1),
        part(1, 'failed'),
        part(2, 'ready', 1),
      ]),
    ).toBe(true);
    expect(
      isNarrationComplete(joined, [
        part(0, 'ready', 1),
        part(1, 'pending'),
        part(2, 'ready', 1),
      ]),
    ).toBe(false);
    expect(
      isNarrationComplete(joined, [
        part(0, 'ready', 1),
        part(1, 'ready', 1),
        part(2, 'ready', 1),
      ]),
    ).toBe(false);
  });
});
