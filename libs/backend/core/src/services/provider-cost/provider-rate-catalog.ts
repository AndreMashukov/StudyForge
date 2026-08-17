import type {
  IProviderRateCatalogEntry,
  IProviderRateSnapshot,
  LlmProviderKind,
  ProviderCostMeter,
} from '@shared-types';
import {
  buildRateCatalogDocId,
  inferProviderCostMeter,
  lookupFallbackRate,
} from '@shared-types';
import type { IProviderUsageUnits } from '@shared-types';
import { getFirestore } from 'firebase-admin/firestore';

const RATE_CATALOG_COLLECTION = 'providerRateCatalog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

  return {
    id,
    providerKind,
    model,
    meter,
    inputUsdPer1M:
      typeof data.inputUsdPer1M === 'number' ? data.inputUsdPer1M : undefined,
    outputUsdPer1M:
      typeof data.outputUsdPer1M === 'number' ? data.outputUsdPer1M : undefined,
    cachedInputUsdPer1M:
      typeof data.cachedInputUsdPer1M === 'number'
        ? data.cachedInputUsdPer1M
        : undefined,
    imageUsdPerMegapixel:
      typeof data.imageUsdPerMegapixel === 'number'
        ? data.imageUsdPerMegapixel
        : undefined,
    defaultSteps:
      typeof data.defaultSteps === 'number' ? data.defaultSteps : undefined,
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

export async function resolveProviderRateSnapshot(params: {
  providerKind: LlmProviderKind;
  model: string;
  units: IProviderUsageUnits;
}): Promise<IProviderRateSnapshot | null> {
  const meter = inferProviderCostMeter(params.units);
  const docId = buildRateCatalogDocId(params.providerKind, params.model);

  try {
    const doc = await getFirestore()
      .collection(RATE_CATALOG_COLLECTION)
      .doc(docId)
      .get();
    if (doc.exists) {
      const parsed = parseRateCatalogEntry(doc.id, doc.data() ?? {});
      if (parsed) {
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
  if (isRecord(imagePixel) && typeof imagePixel.price_per_megapixel === 'number') {
    return {
      id: buildRateCatalogDocId('together', modelId),
      providerKind: 'together',
      model: modelId,
      meter: 'image_megapixel',
      imageUsdPerMegapixel: imagePixel.price_per_megapixel,
      defaultSteps:
        typeof imagePixel.min_steps === 'number' ? imagePixel.min_steps : 4,
      source: 'together_api',
    };
  }

  const input = typeof pricing.input === 'number' ? pricing.input : undefined;
  const output = typeof pricing.output === 'number' ? pricing.output : undefined;
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
    cachedInputUsdPer1M:
      typeof pricing.cached_input === 'number' ? pricing.cached_input : undefined,
    source: 'together_api',
  };
}
