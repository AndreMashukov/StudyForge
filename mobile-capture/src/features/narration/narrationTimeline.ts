import { NARRATION_CHARS_PER_SECOND, type NarrationPart } from '@shared-types';

/**
 * One timeline over all narration parts, so the player can show a single
 * progress bar and skip across parts. Parts without audio yet use an estimate
 * from their length.
 */

export function partDurationMs(part: NarrationPart): number {
  if (part.durationMs !== undefined && part.durationMs > 0)
    return part.durationMs;
  return Math.round((part.charCount / NARRATION_CHARS_PER_SECOND) * 1000);
}

export function isPartPlayable(part: NarrationPart): boolean {
  return part.status === 'ready' && Boolean(part.storagePath);
}

/** Parts the learner will hear or wait for; failed parts are skipped. */
function timelineParts(parts: NarrationPart[]): NarrationPart[] {
  return [...parts]
    .sort((a, b) => a.index - b.index)
    .filter((part) => part.status !== 'failed');
}

export function narrationTotalMs(parts: NarrationPart[]): number {
  return timelineParts(parts).reduce(
    (sum, part) => sum + partDurationMs(part),
    0,
  );
}

/** Position on the whole timeline of a point inside one part. */
export function timelinePositionMs(
  parts: NarrationPart[],
  partIndex: number,
  offsetMs: number,
): number {
  let total = 0;
  for (const part of timelineParts(parts)) {
    if (part.index === partIndex) return total + Math.max(0, offsetMs);
    total += partDurationMs(part);
  }
  return total;
}

export interface ITimelinePoint {
  partIndex: number;
  offsetMs: number;
}

/** The part and offset at a timeline position, clamped to the narration. */
export function locateTimelinePosition(
  parts: NarrationPart[],
  positionMs: number,
): ITimelinePoint | null {
  const ordered = timelineParts(parts);
  if (!ordered.length) return null;
  let remaining = Math.max(0, positionMs);
  for (const part of ordered) {
    const duration = partDurationMs(part);
    if (remaining < duration)
      return { partIndex: part.index, offsetMs: remaining };
    remaining -= duration;
  }
  const last = ordered[ordered.length - 1];
  return { partIndex: last.index, offsetMs: partDurationMs(last) };
}

export type NextPartStep =
  /** Play this part. `skippedFailed` asks for the skip chime first. */
  | { kind: 'play'; partIndex: number; skippedFailed: boolean }
  /** The next part is still being generated. */
  | { kind: 'wait'; partIndex: number; skippedFailed: boolean }
  | { kind: 'end' };

/**
 * What follows a part: the next part in order, skipping failed ones. At the
 * end, a looping narration starts over from its first part.
 */
export function nextPartStep(
  parts: NarrationPart[],
  afterIndex: number,
  loop: boolean,
): NextPartStep {
  const ordered = [...parts].sort((a, b) => a.index - b.index);
  const scan = (
    candidates: NarrationPart[],
    skippedBefore: boolean,
  ): NextPartStep | null => {
    let skippedFailed = skippedBefore;
    for (const part of candidates) {
      if (part.status === 'failed') {
        skippedFailed = true;
        continue;
      }
      return isPartPlayable(part)
        ? { kind: 'play', partIndex: part.index, skippedFailed }
        : { kind: 'wait', partIndex: part.index, skippedFailed };
    }
    return null;
  };

  const after = ordered.filter((part) => part.index > afterIndex);
  const forward = scan(after, false);
  if (forward) return forward;
  if (!loop) return { kind: 'end' };
  const skippedAtEnd = after.some((part) => part.status === 'failed');
  return scan(ordered, skippedAtEnd) ?? { kind: 'end' };
}

/** The first part to play when listening starts. */
export function firstPartStep(parts: NarrationPart[]): NextPartStep {
  return nextPartStep(parts, -1, false);
}

/** The narration part reading a block, for following along in the reader. */
export function partIndexForBlock(
  parts: NarrationPart[],
  blockIndex: number,
): number | null {
  const part = parts.find(
    (entry) => blockIndex >= entry.blockStart && blockIndex <= entry.blockEnd,
  );
  return part ? part.index : null;
}
