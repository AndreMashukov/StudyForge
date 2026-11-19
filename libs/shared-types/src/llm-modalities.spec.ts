import { describe, expect, it } from 'vitest';
import {
  getProviderSupportedModalities,
  isLlmModality,
  normalizeSupportedModalities,
} from './index';

describe('isLlmModality', () => {
  it('accepts every modality including decision', () => {
    for (const modality of ['text', 'vision', 'image', 'embedding', 'decision']) {
      expect(isLlmModality(modality)).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(isLlmModality('audio')).toBe(false);
    expect(isLlmModality(undefined)).toBe(false);
    expect(isLlmModality(1)).toBe(false);
  });
});

describe('getProviderSupportedModalities', () => {
  it('gives decision to OpenRouter only', () => {
    expect(getProviderSupportedModalities('openrouter')).toContain('decision');
    for (const kind of ['gemini', 'minimax', 'together'] as const) {
      expect(getProviderSupportedModalities(kind)).toEqual([
        'text',
        'vision',
        'image',
        'embedding',
      ]);
    }
  });
});

describe('normalizeSupportedModalities', () => {
  it('adds decision to an OpenRouter connection saved before it existed', () => {
    expect(
      normalizeSupportedModalities(
        ['text', 'vision', 'image', 'embedding'],
        'openrouter',
      ),
    ).toEqual(['text', 'vision', 'image', 'embedding', 'decision']);
  });

  it('does not duplicate decision', () => {
    expect(
      normalizeSupportedModalities(['text', 'decision'], 'openrouter'),
    ).toEqual(['text', 'decision']);
  });

  it('drops decision and unknown entries for other providers', () => {
    expect(
      normalizeSupportedModalities(['text', 'decision', 'audio'], 'together'),
    ).toEqual(['text']);
  });

  it('falls back to the provider defaults', () => {
    expect(normalizeSupportedModalities(undefined, 'gemini')).toEqual([
      'text',
      'vision',
      'image',
      'embedding',
    ]);
    expect(normalizeSupportedModalities([], 'openrouter')).toContain(
      'decision',
    );
  });
});
