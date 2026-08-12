/**
 * Gemini thinking budget helpers.
 *
 * Some models reject `thinkingBudget: 0` with:
 * "Budget 0 is invalid. This model only works in thinking mode."
 * (Gemini 2.5 Pro, Gemini 3.x, and Pro aliases such as gemini-pro-latest.)
 */

export function geminiModelAllowsDisablingThinking(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  // Gemini 3.x: thinking cannot be disabled.
  if (normalized.includes('gemini-3')) {
    return false;
  }

  // Gemini 2.5 Pro requires a non-zero budget (or dynamic -1).
  if (normalized.includes('2.5-pro')) {
    return false;
  }

  // Pro aliases (e.g. gemini-pro-latest) map to thinking-required Pro models.
  if (normalized.includes('gemini-pro') && !normalized.includes('flash')) {
    return false;
  }

  return true;
}

export interface IResolveGeminiThinkingBudgetInput {
  model?: string;
  thinkingBudget?: number;
  disableReasoning?: boolean;
}

/**
 * Resolve the thinking budget to send to Gemini.
 * Returns `undefined` to omit `thinkingConfig` (use model defaults).
 */
export function resolveGeminiThinkingBudget(
  input: IResolveGeminiThinkingBudgetInput,
): number | undefined {
  const requested =
    input.thinkingBudget !== undefined
      ? input.thinkingBudget
      : input.disableReasoning
        ? 0
        : undefined;

  if (requested === undefined) {
    return undefined;
  }

  if (
    requested === 0 &&
    input.model &&
    !geminiModelAllowsDisablingThinking(input.model)
  ) {
    // Omit thinkingConfig so the API uses the model default instead of 400ing.
    return undefined;
  }

  return requested;
}
