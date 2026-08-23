import type {
  IProviderRateCatalogEntry,
  LlmProviderKind,
  ProviderCostMeter,
} from './provider-cost';
import {
  buildRateCatalogDocId,
  FALLBACK_PROVIDER_RATE_CATALOG,
} from './provider-rate-fallbacks';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonNegativeFinite(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

function asPositiveFinite(value: unknown): number | undefined {
  const parsed = asNonNegativeFinite(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function extractModelEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (isRecord(payload) && Array.isArray(payload.models)) {
    return payload.models;
  }
  return [];
}

function readModelId(entry: Record<string, unknown>): string {
  if (typeof entry.id === 'string' && entry.id.trim()) {
    return entry.id.trim();
  }
  if (typeof entry.name === 'string' && entry.name.trim()) {
    const rawName = entry.name.trim();
    return rawName.startsWith('models/')
      ? rawName.slice('models/'.length)
      : rawName;
  }
  return '';
}

function rateKey(entry: IProviderRateCatalogEntry): string {
  return `${entry.providerKind}::${entry.model}::${entry.meter}`;
}

function withCatalogDocId(
  entry: IProviderRateCatalogEntry,
): IProviderRateCatalogEntry {
  return {
    ...entry,
    id: buildRateCatalogDocId(entry.providerKind, entry.model),
  };
}

export function parseProviderPricingFromTogetherModel(
  modelId: string,
  pricing: unknown,
): IProviderRateCatalogEntry | null {
  if (!isRecord(pricing)) {
    return null;
  }

  const imagePixel = pricing.image_pixel;
  if (isRecord(imagePixel)) {
    const imageUsdPerMegapixel = asNonNegativeFinite(
      imagePixel.price_per_megapixel,
    );
    if (imageUsdPerMegapixel === undefined) {
      return null;
    }

    return {
      id: buildRateCatalogDocId('together', modelId),
      providerKind: 'together',
      model: modelId,
      meter: 'image_megapixel',
      imageUsdPerMegapixel,
      defaultSteps: asPositiveFinite(imagePixel.min_steps) ?? 4,
      source: 'together_api',
    };
  }

  const input = asNonNegativeFinite(pricing.input);
  const output = asNonNegativeFinite(pricing.output);
  if (input === undefined && output === undefined) {
    return null;
  }

  const meter: ProviderCostMeter =
    modelId.includes('embed') || modelId.includes('e5')
      ? 'embedding_token'
      : 'token';

  return {
    id: buildRateCatalogDocId('together', modelId),
    providerKind: 'together',
    model: modelId,
    meter,
    inputUsdPer1M: input,
    outputUsdPer1M: output ?? input,
    cachedInputUsdPer1M: asNonNegativeFinite(pricing.cached_input),
    source: 'together_api',
  };
}

function parseOpenRouterUsdPerTokenToPer1M(value: unknown): number | undefined {
  const perToken = asNonNegativeFinite(value);
  if (perToken === undefined) {
    return undefined;
  }
  return Number((perToken * 1_000_000).toPrecision(12));
}

export function parseProviderPricingFromOpenRouterModel(
  modelId: string,
  pricing: unknown,
): IProviderRateCatalogEntry | null {
  if (!isRecord(pricing)) {
    return null;
  }

  const inputUsdPer1M = parseOpenRouterUsdPerTokenToPer1M(pricing.prompt);
  const outputUsdPer1M = parseOpenRouterUsdPerTokenToPer1M(pricing.completion);
  if (inputUsdPer1M === undefined && outputUsdPer1M === undefined) {
    return null;
  }

  const meter: ProviderCostMeter =
    modelId.includes('embed') || modelId.includes('e5')
      ? 'embedding_token'
      : 'token';

  return {
    id: buildRateCatalogDocId('openrouter', modelId),
    providerKind: 'openrouter',
    model: modelId,
    meter,
    inputUsdPer1M,
    outputUsdPer1M: outputUsdPer1M ?? inputUsdPer1M,
    cachedInputUsdPer1M: parseOpenRouterUsdPerTokenToPer1M(
      pricing.input_cache_read,
    ),
    source: 'openrouter_api',
  };
}

function parseGenericProviderPricing(
  providerKind: LlmProviderKind,
  modelId: string,
  pricing: unknown,
  source: string,
): IProviderRateCatalogEntry | null {
  if (providerKind === 'together') {
    return parseProviderPricingFromTogetherModel(modelId, pricing);
  }
  if (providerKind === 'openrouter') {
    return parseProviderPricingFromOpenRouterModel(modelId, pricing);
  }
  if (!isRecord(pricing)) {
    return null;
  }

  const input = asNonNegativeFinite(pricing.input ?? pricing.prompt);
  const output = asNonNegativeFinite(pricing.output ?? pricing.completion);
  if (input === undefined && output === undefined) {
    return null;
  }

  const meter: ProviderCostMeter =
    modelId.includes('embed') || modelId.includes('e5')
      ? 'embedding_token'
      : 'token';

  return {
    id: buildRateCatalogDocId(providerKind, modelId),
    providerKind,
    model: modelId,
    meter,
    inputUsdPer1M: input,
    outputUsdPer1M: output ?? input,
    cachedInputUsdPer1M: asNonNegativeFinite(
      pricing.cached_input ?? pricing.input_cache_read,
    ),
    source,
  };
}

export function extractRateCatalogEntriesFromProviderPayload(
  providerKind: LlmProviderKind,
  payload: unknown,
): IProviderRateCatalogEntry[] {
  const source =
    providerKind === 'together'
      ? 'together_api'
      : providerKind === 'openrouter'
        ? 'openrouter_api'
        : `${providerKind}_api`;

  const entries: IProviderRateCatalogEntry[] = [];
  for (const rawEntry of extractModelEntries(payload)) {
    if (!isRecord(rawEntry)) {
      continue;
    }
    const modelId = readModelId(rawEntry);
    if (!modelId) {
      continue;
    }
    const parsed = parseGenericProviderPricing(
      providerKind,
      modelId,
      rawEntry.pricing,
      source,
    );
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries;
}

/** API rates win over checked-in fallbacks for the same provider/model/meter. */
export function buildProviderRateCatalogForSync(
  providerKind: LlmProviderKind,
  payload: unknown,
): IProviderRateCatalogEntry[] {
  const merged = new Map<string, IProviderRateCatalogEntry>();

  for (const fallback of FALLBACK_PROVIDER_RATE_CATALOG) {
    if (fallback.providerKind !== providerKind) {
      continue;
    }
    const entry = withCatalogDocId(fallback);
    merged.set(rateKey(entry), entry);
  }

  for (const entry of extractRateCatalogEntriesFromProviderPayload(
    providerKind,
    payload,
  )) {
    merged.set(rateKey(entry), entry);
  }

  return Array.from(merged.values()).sort((left, right) =>
    left.model.localeCompare(right.model),
  );
}
