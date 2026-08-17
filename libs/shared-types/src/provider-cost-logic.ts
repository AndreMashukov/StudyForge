import type {
  IProviderRateSnapshot,
  IProviderUsageUnits,
  ProviderCostMeter,
} from './provider-cost';

function asFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function inferProviderCostMeter(units: IProviderUsageUnits): ProviderCostMeter {
  if (asFinite(units.megapixels) !== undefined) {
    return 'image_megapixel';
  }
  if (
    asFinite(units.inputTokens) !== undefined ||
    asFinite(units.outputTokens) !== undefined ||
    asFinite(units.reasoningTokens) !== undefined
  ) {
    return 'token';
  }
  return 'embedding_token';
}

export interface ICalculateProviderCostUsdParams {
  units: IProviderUsageUnits;
  rate: IProviderRateSnapshot;
}

export function calculateProviderCostUsd(
  params: ICalculateProviderCostUsdParams,
): number | null {
  const { units, rate } = params;

  if (rate.meter === 'image_megapixel') {
    const megapixels = asFinite(units.megapixels);
    const pricePerMp = rate.imageUsdPerMegapixel;
    if (megapixels === undefined || pricePerMp === undefined) {
      return null;
    }
    const steps = asFinite(units.steps);
    const defaultSteps = rate.defaultSteps ?? 4;
    const stepMultiplier =
      steps !== undefined && defaultSteps > 0 && steps > defaultSteps
        ? steps / defaultSteps
        : 1;
    return megapixels * pricePerMp * stepMultiplier;
  }

  const inputTokens = asFinite(units.inputTokens) ?? 0;
  const outputTokens = asFinite(units.outputTokens) ?? 0;
  const reasoningTokens = asFinite(units.reasoningTokens) ?? 0;
  const cachedInputTokens = asFinite(units.cachedInputTokens) ?? 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const billableOutputTokens = outputTokens + reasoningTokens;

  const inputRate = rate.inputUsdPer1M;
  const outputRate = rate.outputUsdPer1M;
  const cachedRate = rate.cachedInputUsdPer1M ?? inputRate;

  if (inputRate === undefined || outputRate === undefined) {
    return null;
  }

  if (inputTokens === 0 && billableOutputTokens === 0) {
    return null;
  }

  const inputCost = (uncachedInputTokens / 1_000_000) * inputRate;
  const cachedCost =
    cachedInputTokens > 0 && cachedRate !== undefined
      ? (cachedInputTokens / 1_000_000) * cachedRate
      : 0;
  const outputCost = (billableOutputTokens / 1_000_000) * outputRate;

  return inputCost + cachedCost + outputCost;
}
