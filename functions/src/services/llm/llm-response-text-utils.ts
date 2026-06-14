/**
 * Strips MiniMax interleaved thinking blocks from model output.
 * Without reasoning_split, M-series models embed reasoning in content.
 */
export function stripRedactedThinking(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '').trim();
}
