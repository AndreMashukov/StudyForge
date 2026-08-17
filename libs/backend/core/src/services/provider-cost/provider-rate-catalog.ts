import type {
  IProviderRateCatalogEntry,
  IProviderRateSnapshot,
  IProviderUsageUnits,
  LlmProviderKind,
  ProviderCostMeter,
} from '@shared-types';
import {
  buildRateCatalogDocId,
  inferProviderCostMeter,
  lookupFallbackRate,
} from '@shared-types';
import { getFirestore } from 'firebase-admin/firestore';

const RATE_CATALOG_COLLECTION = 'providerRateCatalog';

export interface IResolveProviderRateSnapshotParams {
  providerKind: LlmProviderKind;
  model: string;
  units: IProviderUsageUnits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonNegativeFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function asPositiveFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function parseRateCatalogEntry(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IProviderRateCatalogEntry | null {
  const providerKind = data.providerKind;
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  const meter = data.meter;
  if (
    (providerKind !== 'gemini' &&
      providerKind !== 'openrouter' &&
      providerKind !== 'minimax' &&
      providerKind !== 'together') ||
    !model ||
    (meter !== 'token' && meter !== 'image_megapixel' && meter !== 'embedding_token')
  ) {
    return null;
  }

  const defaultSteps = asPositiveFinite(data.defaultSteps);

  return {
    id,
    providerKind,
    model,
    meter,
    inputUsdPer1M: asNonNegativeFinite(data.inputUsdPer1M),
    outputUsdPer1M: asNonNegativeFinite(data.outputUsdPer1M),
    cachedInputUsdPer1M: asNonNegativeFinite(data.cachedInputUsdPer1M),
    imageUsdPerMegapixel: asNonNegativeFinite(data.imageUsdPerMegapixel),
    defaultSteps,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    source: typeof data.source === 'string' ? data.source : undefined,
  };
}

function toRateSnapshot(
  entry: IProviderRateCatalogEntry,
  source: IProviderRateSnapshot['source'],
): IProviderRateSnapshot {
  return {
    meter: entry.meter,
    inputUsdPer1M: entry.inputUsdPer1M,
    outputUsdPer1M: entry.outputUsdPer1M,
    cachedInputUsdPer1M: entry.cachedInputUsdPer1M,
    imageUsdPerMegapixel: entry.imageUsdPerMegapixel,
    defaultSteps: entry.defaultSteps,
    rateCatalogDocId: entry.id,
    source,
  };
}

export async function resolveProviderRateSnapshot(
  params: IResolveProviderRateSnapshotParams,
): Promise<IProviderRateSnapshot | null> {
  const meter = inferProviderCostMeter(params.units);
  const docId = buildRateCatalogDocId(params.providerKind, params.model);

  try {
    const doc = await getFirestore()
      .collection(RATE_CATALOG_COLLECTION)
      .doc(docId)
      .get();
    if (doc.exists) {
      const parsed = parseRateCatalogEntry(doc.id, doc.data() ?? {});
      if (
        parsed &&
        parsed.providerKind === params.providerKind &&
        parsed.model === params.model &&
        parsed.meter === meter
      ) {
        return toRateSnapshot(parsed, 'firestore_catalog');
      }
    }
  } catch {
    // Fall through to checked-in catalog.
  }

  const fallback = lookupFallbackRate(params.providerKind, params.model, meter);
  if (!fallback) {
    return null;
  }

  return toRateSnapshot(fallback, 'fallback_catalog');
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
    const imageUsdPerMegapixel = asNonNegativeFinite(imagePixel.price_per_megapixel);
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
