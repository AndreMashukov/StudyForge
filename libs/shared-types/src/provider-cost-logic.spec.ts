import { describe, expect, it } from 'vitest';
import {
  calculateProviderCostUsd,
  inferProviderCostMeter,
} from './provider-cost-logic';
import type { IProviderRateSnapshot } from './provider-cost';

describe('shared provider-cost-logic', () => {
  it('computes token cost', () => {
    const rate: IProviderRateSnapshot = {
      meter: 'token',
      inputUsdPer1M: 1,
      outputUsdPer1M: 2,
      source: 'fallback_catalog',
    };

    expect(
      calculateProviderCostUsd({
        units: { inputTokens: 1_000_000, outputTokens: 500_000 },
        rate,
      }),
    ).toBeCloseTo(2, 5);
  });

  it('includes reasoning tokens in billable output', () => {
    const rate: IProviderRateSnapshot = {
      meter: 'token',
      inputUsdPer1M: 1,
      outputUsdPer1M: 2,
      source: 'fallback_catalog',
    };

    expect(
      calculateProviderCostUsd({
        units: {
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          reasoningTokens: 400_000,
        },
        rate,
      }),
    ).toBeCloseTo(2, 5);
  });

  it('infers meters from usage units', () => {
    expect(inferProviderCostMeter({ megapixels: 2 })).toBe('image_megapixel');
    expect(inferProviderCostMeter({ inputTokens: 10 })).toBe('token');
    expect(inferProviderCostMeter({ reasoningTokens: 5 })).toBe('token');
  });
});
