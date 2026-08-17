import type { IProviderUsageUnits } from '@shared-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

/** OpenAI-compatible usage object (Together, OpenRouter, MiniMax). */
export function normalizeOpenAiCompatibleUsage(
  usage: unknown,
): IProviderUsageUnits | null {
  if (!isRecord(usage)) {
    return null;
  }

  const promptTokens = asNonNegativeInt(usage.prompt_tokens);
  const completionTokens = asNonNegativeInt(usage.completion_tokens);
  const totalTokens = asNonNegativeInt(usage.total_tokens);

  const details = isRecord(usage.prompt_tokens_details)
    ? usage.prompt_tokens_details
    : isRecord(usage.input_tokens_details)
      ? usage.input_tokens_details
      : null;
  const cachedInputTokens =
    details && asNonNegativeInt(details.cached_tokens) !== undefined
      ? asNonNegativeInt(details.cached_tokens)
      : asNonNegativeInt(usage.cached_tokens);

  const completionDetails = isRecord(usage.completion_tokens_details)
    ? usage.completion_tokens_details
    : null;
  const reasoningTokens =
    completionDetails && asNonNegativeInt(completionDetails.reasoning_tokens) !== undefined
      ? asNonNegativeInt(completionDetails.reasoning_tokens)
      : undefined;

  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return null;
  }

  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens,
  };
}

/** Gemini usageMetadata from @google/genai responses. */
export function normalizeGeminiUsageMetadata(
  usageMetadata: unknown,
): IProviderUsageUnits | null {
  if (!isRecord(usageMetadata)) {
    return null;
  }

  const promptTokens = asNonNegativeInt(usageMetadata.promptTokenCount);
  const outputTokens = asNonNegativeInt(usageMetadata.candidatesTokenCount);
  const cachedInputTokens = asNonNegativeInt(usageMetadata.cachedContentTokenCount);
  const totalTokens = asNonNegativeInt(usageMetadata.totalTokenCount);

  if (
    promptTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined
  ) {
    return null;
  }

  return {
    inputTokens: promptTokens,
    outputTokens: outputTokens,
    cachedInputTokens,
    totalTokens,
  };
}

export function buildImageMegapixelUsage(params: {
  width: number;
  height: number;
  steps?: number;
}): IProviderUsageUnits {
  const megapixels = (params.width * params.height) / 1_000_000;
  return {
    megapixels,
    steps: params.steps,
  };
}

export function buildEmbeddingBatchUsage(totalTokens: number): IProviderUsageUnits {
  return {
    inputTokens: totalTokens,
    outputTokens: 0,
    totalTokens,
  };
}
