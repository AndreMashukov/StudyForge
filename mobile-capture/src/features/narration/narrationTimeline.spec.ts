import { describe, expect, it } from 'vitest';
import type { NarrationPart } from '@shared-types';
import {
  firstPartStep,
  locateTimelinePosition,
  narrationTotalMs,
  nextPartStep,
  partDurationMs,
  timelinePositionMs,
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
    part(0, 'ready', 60_000),
    part(1, 'ready', 30_000),
    part(2, 'failed'),
    part(3, 'pending'),
  ];

  it('adds real durations and estimates, leaving out failed parts', () => {
    expect(partDurationMs(part(3, 'pending'))).toBe(100_000);
    expect(narrationTotalMs(parts)).toBe(60_000 + 30_000 + 100_000);
  });

  it('maps between part offsets and timeline positions', () => {
    expect(timelinePositionMs(parts, 1, 5_000)).toBe(65_000);
    expect(locateTimelinePosition(parts, 65_000)).toEqual({
      partIndex: 1,
      offsetMs: 5_000,
    });
    expect(locateTimelinePosition(parts, 95_000)).toEqual({
      partIndex: 3,
      offsetMs: 5_000,
    });
    expect(locateTimelinePosition(parts, -10)).toEqual({
      partIndex: 0,
      offsetMs: 0,
    });
    expect(locateTimelinePosition(parts, 10_000_000)).toEqual({
      partIndex: 3,
      offsetMs: 100_000,
    });
  });
});

describe('nextPartStep', () => {
  it('plays the next ready part', () => {
    expect(
      nextPartStep([part(0, 'ready'), part(1, 'ready')], 0, false),
    ).toEqual({
      kind: 'play',
      partIndex: 1,
      skippedFailed: false,
    });
  });

  it('skips a failed part and asks for the chime', () => {
    expect(
      nextPartStep(
        [part(0, 'ready'), part(1, 'failed'), part(2, 'ready')],
        0,
        false,
      ),
    ).toEqual({
      kind: 'play',
      partIndex: 2,
      skippedFailed: true,
    });
  });

  it('waits for a part still being generated', () => {
    expect(
      nextPartStep([part(0, 'ready'), part(1, 'generating')], 0, false),
    ).toEqual({
      kind: 'wait',
      partIndex: 1,
      skippedFailed: false,
    });
  });

  it('ends without loop and starts over with loop', () => {
    const done = [part(0, 'ready'), part(1, 'ready')];
    expect(nextPartStep(done, 1, false)).toEqual({ kind: 'end' });
    expect(nextPartStep(done, 1, true)).toEqual({
      kind: 'play',
      partIndex: 0,
      skippedFailed: false,
    });
  });

  it('chimes when looping past a failed last part', () => {
    expect(
      nextPartStep([part(0, 'ready'), part(1, 'failed')], 0, true),
    ).toEqual({
      kind: 'play',
      partIndex: 0,
      skippedFailed: true,
    });
  });

  it('ends when nothing can play', () => {
    expect(firstPartStep([part(0, 'failed')])).toEqual({ kind: 'end' });
    expect(nextPartStep([part(0, 'failed')], 0, true)).toEqual({ kind: 'end' });
  });
});
