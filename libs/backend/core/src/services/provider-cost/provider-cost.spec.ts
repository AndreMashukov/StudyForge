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
import {
  buildProviderCostContext,
  getRunningAgentLoopCredits,
  isAgentLoopBudgetExhausted,
  runWithProviderCostContext,
} from './provider-cost-context';

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

  it('bills reasoning tokens at the output rate', () => {
    const rate: IProviderRateSnapshot = {
      meter: 'token',
      inputUsdPer1M: 1,
      outputUsdPer1M: 2,
      source: 'fallback_catalog',
    };

    const cost = calculateProviderCostUsd({
      units: {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 1_000_000,
      },
      rate,
    });

    expect(cost).toBeCloseTo(2, 5);
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

  it('normalizes Gemini thinking tokens as reasoning', () => {
    const units = normalizeGeminiUsageMetadata({
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 40,
      totalTokenCount: 160,
    });

    expect(units?.outputTokens).toBe(20);
    expect(units?.reasoningTokens).toBe(40);
  });

  it('falls back to Gemini responseTokenCount', () => {
    const units = normalizeGeminiUsageMetadata({
      promptTokenCount: 50,
      responseTokenCount: 10,
    });

    expect(units?.outputTokens).toBe(10);
  });

  it('infers image meter from megapixels', () => {
    expect(inferProviderCostMeter({ megapixels: 1 })).toBe('image_megapixel');
    expect(inferProviderCostMeter({ inputTokens: 1, outputTokens: 2 })).toBe(
      'token',
    );
  });
});

describe('agent loop budget helpers', () => {
  it('is not exhausted before any billable loop cost', async () => {
    const context = buildProviderCostContext({
      userId: 'user-1',
      loopBudgetCredits: 50,
      pricePerCreditCents: 2.5,
      callRole: 'agent_step',
    });

    await runWithProviderCostContext(context, async () => {
      expect(isAgentLoopBudgetExhausted()).toBe(false);
      expect(getRunningAgentLoopCredits()).toBe(0);
    });
  });

  it('is exhausted when running loop credits reach the hold', async () => {
    const context = buildProviderCostContext({
      userId: 'user-1',
      loopBudgetCredits: 10,
      pricePerCreditCents: 2.5,
      callRole: 'agent_step',
    });
    context.loopKnownCostUsd = 0.4;

    await runWithProviderCostContext(context, async () => {
      expect(getRunningAgentLoopCredits()).toBe(10);
      expect(isAgentLoopBudgetExhausted()).toBe(true);
    });
  });
});
