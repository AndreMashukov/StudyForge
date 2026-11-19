import {
  getStorageString,
  hydrateAppStorage,
  setStorageString,
} from './appStorage';

const READER_TEXT_SCALE_KEY = 'studyforge.mobile.readerTextScale';

/** Text size steps offered in the document reader, smallest to largest. */
export const READER_TEXT_SCALES = [0.9, 1, 1.15, 1.3, 1.5] as const;

export type ReaderTextScale = (typeof READER_TEXT_SCALES)[number];

export const DEFAULT_READER_TEXT_SCALE: ReaderTextScale = 1;

export function isReaderTextScale(value: unknown): value is ReaderTextScale {
  return READER_TEXT_SCALES.some((scale) => scale === value);
}

/** Parses a stored value, falling back to the default for missing or unknown steps. */
export function parseReaderTextScale(raw: string | undefined): ReaderTextScale {
  const value = raw === undefined ? NaN : Number(raw);
  return isReaderTextScale(value) ? value : DEFAULT_READER_TEXT_SCALE;
}

export function getReaderTextScale(): ReaderTextScale {
  return parseReaderTextScale(getStorageString(READER_TEXT_SCALE_KEY));
}

export function setReaderTextScale(scale: ReaderTextScale): void {
  setStorageString(READER_TEXT_SCALE_KEY, String(scale));
}

export async function hydrateReaderTextScaleStorage(): Promise<void> {
  await hydrateAppStorage([READER_TEXT_SCALE_KEY]);
}
