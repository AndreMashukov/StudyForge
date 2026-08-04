const REDACTED = 'redacted';
const THINKING = 'thinking';
const THINK_SHORT = 'think';
const REDACTED_THINKING_OPEN = `<${REDACTED}_${THINKING}>`;
const REDACTED_THINKING_CLOSE = `</${REDACTED}_${THINKING}>`;
const REDACTED_THINKING_ALT_CLOSE = `</${THINK_SHORT}>`;
const MM_THINK_OPEN = '<mm:think>';
const MM_THINK_CLOSE = '</mm:think>';

/**
 * Removes leaked MiniMax reasoning wrappers from agent chat text before display.
 */
export function stripAgentThinkingContent(content: string): string {
  return content
    .replace(
      new RegExp(`${REDACTED_THINKING_OPEN}[\\s\\S]*?${REDACTED_THINKING_CLOSE}`, 'gi'),
      '',
    )
    .replace(
      new RegExp(`${REDACTED_THINKING_OPEN}[\\s\\S]*?${REDACTED_THINKING_ALT_CLOSE}`, 'gi'),
      '',
    )
    .replace(new RegExp(`${MM_THINK_OPEN}[\\s\\S]*?${MM_THINK_CLOSE}`, 'gi'), '')
    .trim();
}
