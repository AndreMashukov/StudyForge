const TOGETHER_TOP_P_RANGE =
  /top_p must be within \[([0-9]*\.?[0-9]+),\s*([0-9]*\.?[0-9]+)\]/i;

/**
 * Some Together models reject top_p outside a narrow band
 * (invalid_top_p, for example [0.95, 1]).
 * Returns a value inside the range from the error text.
 * Returns undefined when the error is unrelated, or the sent value is already legal,
 * so the caller does not retry.
 */
export function topPInsideTogetherErrorRange(
  topP: number | undefined,
  errorText: string,
): number | undefined {
  if (topP === undefined || !Number.isFinite(topP)) {
    return undefined;
  }

  const match = errorText.match(TOGETHER_TOP_P_RANGE);
  if (!match) {
    return undefined;
  }

  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return undefined;
  }

  const clamped = Math.min(max, Math.max(min, topP));
  if (clamped === topP) {
    return undefined;
  }

  return clamped;
}
