import { NARRATION_CHARS_PER_SECOND, type NarrationPart } from '@shared-types';

/**
 * The narration plays as ONE audio file: the ready parts joined in order. That
 * is what keeps it playing with the app in the background or the phone locked,
 * because nothing has to switch audio at a part boundary. These helpers map a
 * position in that joined audio back to the part being read.
 */

export function partDurationMs(part: NarrationPart): number {
  if (part.durationMs !== undefined && part.durationMs > 0)
    return part.durationMs;
  return Math.round((part.charCount / NARRATION_CHARS_PER_SECOND) * 1000);
}

export function isPartPlayable(part: NarrationPart): boolean {
  return part.status === 'ready' && Boolean(part.storagePath);
}

/** The parts that go into the joined audio: ready ones, in document order. */
export function playableParts(parts: NarrationPart[]): NarrationPart[] {
  return parts.filter(isPartPlayable).sort((a, b) => a.index - b.index);
}

/** Length of the joined audio of these parts. */
export function joinedDurationMs(included: NarrationPart[]): number {
  return included.reduce((sum, part) => sum + partDurationMs(part), 0);
}

/**
 * Length shown before the audio is loaded: every part that is or will be
 * narrated (failed parts are skipped), with an estimate for those not ready.
 */
export function narrationTotalMs(parts: NarrationPart[]): number {
  return parts
    .filter((part) => part.status !== 'failed')
    .reduce((sum, part) => sum + partDurationMs(part), 0);
}

/** True when the parts that are ready now differ from those in a loaded file. */
export function hasNewPlayableParts(
  included: NarrationPart[],
  parts: NarrationPart[],
): boolean {
  const known = new Set(included.map((part) => part.key));
  return playableParts(parts).some((part) => !known.has(part.key));
}

/** The part being read at a position in the joined audio, or null when empty. */
export function partIndexAtPosition(
  included: NarrationPart[],
  positionMs: number,
): number | null {
  if (!included.length) return null;
  let remaining = Math.max(0, positionMs);
  for (const part of included) {
    const duration = partDurationMs(part);
    if (remaining < duration) return part.index;
    remaining -= duration;
  }
  return included[included.length - 1].index;
}
