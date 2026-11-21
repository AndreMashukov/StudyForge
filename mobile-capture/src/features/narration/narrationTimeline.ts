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

/**
 * True when the loaded file already has every part that will ever play: no
 * part is waiting to be narrated and none became ready since it was joined.
 * Only then can the player loop the file on its own.
 */
export function isNarrationComplete(
  included: NarrationPart[],
  parts: NarrationPart[],
): boolean {
  const known = new Set(included.map((part) => part.key));
  return parts.every((part) => part.status === 'failed' || known.has(part.key));
}

/**
 * The same place in another joined file: the same part, the same distance
 * into it. Parts that became ready earlier in the document shift everything
 * after them, so a position cannot be reused as it is. A position past the end
 * of `from` maps to the first part not in it; a part `to` no longer has maps
 * to the start of the next part after it.
 */
export function mapPositionMs(
  from: NarrationPart[],
  to: NarrationPart[],
  positionMs: number,
): number {
  let remaining = Math.max(0, positionMs);
  let current: NarrationPart | null = null;
  for (const part of from) {
    const duration = partDurationMs(part);
    if (remaining < duration) {
      current = part;
      break;
    }
    remaining -= duration;
  }
  if (!current) return firstUnheardOffsetMs(from, to) ?? 0;

  let offset = 0;
  for (const part of to) {
    if (part.key === current.key) {
      return offset + Math.min(remaining, partDurationMs(part));
    }
    if (part.index > current.index) return offset;
    offset += partDurationMs(part);
  }
  return offset;
}

/**
 * Where to carry on after the file of `heard` played to its end and a longer
 * file of `next` replaced it: the start of the first part the listener has not
 * heard, in the new layout. Parts can become ready out of order, so this is
 * not simply the length of what was heard. Null when nothing is new.
 */
export function firstUnheardOffsetMs(
  heard: NarrationPart[],
  next: NarrationPart[],
): number | null {
  const known = new Set(heard.map((part) => part.key));
  let offset = 0;
  for (const part of next) {
    if (!known.has(part.key)) return offset;
    offset += partDurationMs(part);
  }
  return null;
}
