/**
 * Strips MiniMax interleaved thinking blocks from model output.
 * Without reasoning_split / Together reasoning separation, M-series models
 * may embed reasoning in content behind these wrappers.
 */
export function stripRedactedThinking(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<redacted_thinking>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<mm:think>[\s\S]*?<\/mm:think>/gi, '')
    .trim();
}
