import { describe, expect, it } from 'vitest';
import {
  buildProviderRateCatalogForSync,
  extractRateCatalogEntriesFromProviderPayload,
  parseProviderPricingFromOpenRouterModel,
  parseProviderPricingFromTogetherModel,
} from './provider-rate-catalog-parse';

describe('provider-rate-catalog-parse', () => {
  it('parses Together token pricing already quoted per 1M tokens', () => {
    const entry = parseProviderPricingFromTogetherModel(
      'Qwen/Qwen3.8-2.4T-A95B',
      {
        input: 2.5,
        output: 6.25,
        cached_input: 0.5,
      },
    );

    expect(entry).toEqual({
      id: 'together__Qwen__Qwen3.8-2.4T-A95B',
      providerKind: 'together',
      model: 'Qwen/Qwen3.8-2.4T-A95B',
      meter: 'token',
      inputUsdPer1M: 2.5,
      outputUsdPer1M: 6.25,
      cachedInputUsdPer1M: 0.5,
      source: 'together_api',
    });
  });

  it('parses Together image pricing', () => {
    const entry = parseProviderPricingFromTogetherModel(
      'black-forest-labs/FLUX.1-schnell',
      {
        image_pixel: {
          price_per_megapixel: 0.0027,
          min_steps: 4,
        },
      },
    );

    expect(entry).toMatchObject({
      meter: 'image_megapixel',
      imageUsdPerMegapixel: 0.0027,
      defaultSteps: 4,
    });
  });

  it('converts OpenRouter per-token prices to per 1M', () => {
    const entry = parseProviderPricingFromOpenRouterModel(
      'qwen/qwen3.8-2.4t-a95b',
      {
        prompt: '0.000002',
        completion: '0.000006',
        input_cache_read: '0.0000002',
      },
    );

    expect(entry).toEqual({
      id: 'openrouter__qwen__qwen3.8-2.4t-a95b',
      providerKind: 'openrouter',
      model: 'qwen/qwen3.8-2.4t-a95b',
      meter: 'token',
      inputUsdPer1M: 2,
      outputUsdPer1M: 6,
      cachedInputUsdPer1M: 0.2,
      source: 'openrouter_api',
    });
  });

  it('extracts the full Together catalog and overlays fallbacks', () => {
    const catalog = buildProviderRateCatalogForSync('together', [
      {
        id: 'Qwen/Qwen3.8-2.4T-A95B',
        pricing: { input: 2.5, output: 6.25, cached_input: 0.5 },
      },
      {
        id: 'MiniMaxAI/MiniMax-M3',
        pricing: { input: 0.3, output: 1.2, cached_input: 0.06 },
      },
    ]);

    const qwen38 = catalog.find(
      (entry) => entry.model === 'Qwen/Qwen3.8-2.4T-A95B',
    );
    const minimax = catalog.find(
      (entry) => entry.model === 'MiniMaxAI/MiniMax-M3',
    );
    const qwen37 = catalog.find((entry) => entry.model === 'Qwen/Qwen3.7-Plus');

    expect(qwen38?.source).toBe('together_api');
    expect(qwen38?.inputUsdPer1M).toBe(2.5);
    expect(minimax?.source).toBe('together_api');
    expect(qwen37?.source).toBe('fallback_catalog');
    expect(catalog.length).toBeGreaterThan(2);
  });

  it('returns no API entries when the payload has no pricing', () => {
    expect(
      extractRateCatalogEntriesFromProviderPayload('gemini', {
        models: [{ name: 'models/gemini-pro-latest' }],
      }),
    ).toEqual([]);
  });
});
