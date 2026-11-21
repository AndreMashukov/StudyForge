import {
  NARRATION_PLAYBACK_RATES,
  type NarrationPlaybackRate,
} from '@shared-types';
import {
  getStorageString,
  hydrateAppStorage,
  setStorageString,
} from './appStorage';

const RATE_KEY = 'studyforge.mobile.narrationRate';
const LOOP_KEY = 'studyforge.mobile.narrationLoop';
// v2: a position in the joined audio (v1 stored a part index and an offset).
const POSITION_KEY_PREFIX = 'studyforge.mobile.narrationPosition.v2.';

export const DEFAULT_NARRATION_RATE: NarrationPlaybackRate = 1;

export function isNarrationPlaybackRate(
  value: unknown,
): value is NarrationPlaybackRate {
  return NARRATION_PLAYBACK_RATES.some((rate) => rate === value);
}

export function parseNarrationRate(
  raw: string | undefined,
): NarrationPlaybackRate {
  const value = raw === undefined ? NaN : Number(raw);
  return isNarrationPlaybackRate(value) ? value : DEFAULT_NARRATION_RATE;
}

export function getNarrationRate(): NarrationPlaybackRate {
  return parseNarrationRate(getStorageString(RATE_KEY));
}

export function setNarrationRate(rate: NarrationPlaybackRate): void {
  setStorageString(RATE_KEY, String(rate));
}

export function getNarrationLoop(): boolean {
  return getStorageString(LOOP_KEY) === 'true';
}

export function setNarrationLoop(loop: boolean): void {
  setStorageString(LOOP_KEY, loop ? 'true' : 'false');
}

export async function hydrateNarrationStorage(): Promise<void> {
  await hydrateAppStorage([RATE_KEY, LOOP_KEY]);
}

/**
 * Where listening stopped in one document, on this device: a position in the
 * joined audio, in milliseconds.
 */
export function parseNarrationPosition(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function loadNarrationPosition(
  documentId: string,
): Promise<number | null> {
  const key = `${POSITION_KEY_PREFIX}${documentId}`;
  await hydrateAppStorage([key]);
  return parseNarrationPosition(getStorageString(key));
}

export function saveNarrationPosition(
  documentId: string,
  positionMs: number,
): void {
  setStorageString(
    `${POSITION_KEY_PREFIX}${documentId}`,
    String(Math.round(positionMs)),
  );
}
