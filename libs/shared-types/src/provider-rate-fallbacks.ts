import type {
  IProviderRateCatalogEntry,
  LlmProviderKind,
  ProviderCostMeter,
} from './provider-cost';

/** Checked-in fallback rates (USD). Together values from GET /v1/models, Aug 2026. */
export const FALLBACK_PROVIDER_RATE_CATALOG: IProviderRateCatalogEntry[] = [
  {
    id: 'together-minimax-m3',
    providerKind: 'together',
    model: 'MiniMaxAI/MiniMax-M3',
    meter: 'token',
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 1.2,
    cachedInputUsdPer1M: 0.06,
    source: 'fallback_catalog',
  },
  {
    id: 'together-qwen37-plus',
    providerKind: 'together',
    model: 'Qwen/Qwen3.7-Plus',
    meter: 'token',
    inputUsdPer1M: 0.32,
    outputUsdPer1M: 1.28,
    source: 'fallback_catalog',
  },
  {
    id: 'together-qwen38-24t',
    providerKind: 'together',
    model: 'Qwen/Qwen3.8-2.4T-A95B',
    meter: 'token',
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 6.25,
    cachedInputUsdPer1M: 0.5,
    source: 'fallback_catalog',
  },
  {
    id: 'together-glm-52',
    providerKind: 'together',
    model: 'zai-org/GLM-5.2',
    meter: 'token',
    inputUsdPer1M: 1.4,
    outputUsdPer1M: 4.4,
    cachedInputUsdPer1M: 0.26,
    source: 'fallback_catalog',
  },
  {
    id: 'together-e5-large',
    providerKind: 'together',
    model: 'intfloat/multilingual-e5-large-instruct',
    meter: 'embedding_token',
    inputUsdPer1M: 0.02,
    outputUsdPer1M: 0.02,
    source: 'fallback_catalog',
  },
  {
    id: 'together-flux-schnell',
    providerKind: 'together',
    model: 'black-forest-labs/FLUX.1-schnell',
    meter: 'image_megapixel',
    imageUsdPerMegapixel: 0.0027,
    defaultSteps: 4,
    source: 'fallback_catalog',
  },
  {
    id: 'together-deepseek-v4-pro',
    providerKind: 'together',
    model: 'deepseek-ai/DeepSeek-V4-Pro',
    meter: 'token',
    inputUsdPer1M: 1.74,
    outputUsdPer1M: 3.48,
    cachedInputUsdPer1M: 0.2,
    source: 'fallback_catalog',
  },
  {
    id: 'together-kimi-k27-code',
    providerKind: 'together',
    model: 'moonshotai/Kimi-K2.7-Code',
    meter: 'token',
    inputUsdPer1M: 0.95,
    outputUsdPer1M: 4.0,
    cachedInputUsdPer1M: 0.19,
    source: 'fallback_catalog',
  },
  {
    id: 'together-kimi-k3',
    providerKind: 'together',
    model: 'moonshotai/Kimi-K3',
    meter: 'token',
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    cachedInputUsdPer1M: 0.3,
    source: 'fallback_catalog',
  },
  {
    id: 'gemini-flash',
    providerKind: 'gemini',
    model: 'gemini-2.5-flash',
    meter: 'token',
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    source: 'fallback_catalog',
  },
  {
    id: 'gemini-pro-latest',
    providerKind: 'gemini',
    model: 'gemini-pro-latest',
    meter: 'token',
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 5.0,
    source: 'fallback_catalog',
  },
  {
    id: 'gemini-image-preview',
    providerKind: 'gemini',
    model: 'gemini-3.1-flash-image-preview',
    meter: 'image_megapixel',
    imageUsdPerMegapixel: 0.039,
    defaultSteps: 1,
    source: 'fallback_catalog',
  },
];

export function buildRateCatalogDocId(
  providerKind: LlmProviderKind,
  model: string,
): string {
  const normalizedModel = model.trim().replace(/\//g, '__');
  return `${providerKind}__${normalizedModel}`;
}

export function lookupFallbackRate(
  providerKind: LlmProviderKind,
  model: string,
  meter: ProviderCostMeter,
): IProviderRateCatalogEntry | undefined {
  const exact = FALLBACK_PROVIDER_RATE_CATALOG.find(
    (entry) =>
      entry.providerKind === providerKind &&
      entry.model === model &&
      entry.meter === meter,
  );
  if (exact) {
    return exact;
  }

  return FALLBACK_PROVIDER_RATE_CATALOG.find(
    (entry) => entry.providerKind === providerKind && entry.model === model,
  );
}
