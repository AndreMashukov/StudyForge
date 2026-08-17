import { describe, expect, it } from 'vitest';
import {
  calculateProviderCostUsd,
  inferProviderCostMeter,
  type IProviderRateSnapshot,
} from '@shared-types';
import {
  normalizeGeminiUsageMetadata,
  normalizeOpenAiCompatibleUsage,
} from './provider-usage-normalizer';

describe('provider-cost-logic', () => {
  it('computes token cost with cached input discount', () => {
    const rate: IProviderRateSnapshot = {
      meter: 'token',
      inputUsdPer1M: 0.3,
      outputUsdPer1M: 1.2,
      cachedInputUsdPer1M: 0.06,
      source: 'fallback_catalog',
    };

    const cost = calculateProviderCostUsd({
      units: {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cachedInputTokens: 200_000,
      },
      rate,
    });

    expect(cost).toBeCloseTo(0.3 * 0.8 + 0.06 * 0.2 + 1.2 * 0.5, 5);
  });

  it('computes image megapixel cost with step multiplier', () => {
    const rate: IProviderRateSnapshot = {
      meter: 'image_megapixel',
      imageUsdPerMegapixel: 0.0027,
      defaultSteps: 4,
      source: 'fallback_catalog',
    };

    const cost = calculateProviderCostUsd({
      units: { megapixels: 1, steps: 8 },
      rate,
    });

    expect(cost).toBeCloseTo(0.0027 * 2, 6);
  });
});

describe('provider-usage-normalizer', () => {
  it('normalizes OpenAI-compatible usage', () => {
    const units = normalizeOpenAiCompatibleUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 20 },
    });

    expect(units).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 20,
      reasoningTokens: undefined,
      totalTokens: 150,
    });
  });

  it('normalizes Gemini usage metadata', () => {
    const units = normalizeGeminiUsageMetadata({
      promptTokenCount: 200,
      candidatesTokenCount: 80,
      cachedContentTokenCount: 10,
      totalTokenCount: 280,
    });

    expect(units?.inputTokens).toBe(200);
    expect(units?.outputTokens).toBe(80);
    expect(units?.cachedInputTokens).toBe(10);
  });

  it('infers image meter from megapixels', () => {
    expect(inferProviderCostMeter({ megapixels: 1 })).toBe('image_megapixel');
    expect(inferProviderCostMeter({ inputTokens: 1, outputTokens: 2 })).toBe(
      'token',
    );
  });
});
