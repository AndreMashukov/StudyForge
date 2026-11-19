import { describe, expect, it, vi } from 'vitest';

vi.mock('./appStorage', () => ({
  getStorageString: vi.fn(),
  hydrateAppStorage: vi.fn(),
  setStorageString: vi.fn(),
}));

import {
  DEFAULT_READER_TEXT_SCALE,
  isReaderTextScale,
  parseReaderTextScale,
} from './readerTextScaleStorage';

describe('reader text scale storage', () => {
  it('restores a stored step', () => {
    expect(parseReaderTextScale('1.3')).toBe(1.3);
    expect(parseReaderTextScale('0.9')).toBe(0.9);
  });
  it('falls back to the default for missing, malformed or unknown values', () => {
    expect(parseReaderTextScale(undefined)).toBe(DEFAULT_READER_TEXT_SCALE);
    expect(parseReaderTextScale('')).toBe(DEFAULT_READER_TEXT_SCALE);
    expect(parseReaderTextScale('big')).toBe(DEFAULT_READER_TEXT_SCALE);
    expect(parseReaderTextScale('2')).toBe(DEFAULT_READER_TEXT_SCALE);
  });
  it('only accepts the offered steps', () => {
    expect(isReaderTextScale(1.15)).toBe(true);
    expect(isReaderTextScale(1.2)).toBe(false);
    expect(isReaderTextScale('1')).toBe(false);
  });
});
