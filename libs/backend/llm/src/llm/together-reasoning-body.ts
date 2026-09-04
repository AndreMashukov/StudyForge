/**
 * Together's documented hybrid switch is `reasoning.enabled`.
 * MiniMax-M3 and GLM-5.2 ignore that field. `thinking.type=disabled`
 * (native MiniMax) turns thinking off on those models and on Qwen.
 * Send both when disableReasoning is set so the admin flag applies
 * across Together models.
 */
export function togetherReasoningBodyExtras(
  _model: string,
  disableReasoning?: boolean,
): Record<string, unknown> {
  if (!disableReasoning) {
    return {};
  }

  return {
    reasoning: { enabled: false },
    thinking: { type: 'disabled' },
  };
}
