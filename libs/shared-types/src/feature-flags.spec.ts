import { describe, expect, it } from 'vitest';
import {
  defaultFeatureFlags,
  parseFeatureFlags,
} from './feature-flags';

describe('defaultFeatureFlags', () => {
  it('enables Support on the emulator', () => {
    expect(defaultFeatureFlags(true)).toEqual({ supportEnabled: true });
  });

  it('disables Support in production', () => {
    expect(defaultFeatureFlags(false)).toEqual({ supportEnabled: false });
  });
});

describe('parseFeatureFlags', () => {
  const fallback = { supportEnabled: true };

  it('uses a stored boolean', () => {
    expect(parseFeatureFlags({ supportEnabled: false }, fallback)).toEqual({
      supportEnabled: false,
    });
  });

  it('falls back when the field is missing', () => {
    expect(parseFeatureFlags({}, fallback)).toEqual(fallback);
  });
});
