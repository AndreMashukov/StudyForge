const REDACTED = 'redacted';
const THINKING = 'thinking';
const THINK_SHORT = 'think';
const REDACTED_THINKING_OPEN = `<${REDACTED}_${THINKING}>`;
const REDACTED_THINKING_CLOSE = `</${REDACTED}_${THINKING}>`;
const REDACTED_THINKING_ALT_CLOSE = `</${THINK_SHORT}>`;
const MM_THINK_OPEN = '<mm:think>';
const MM_THINK_CLOSE = '</mm:think>';

const THINKING_TAG_PREFIXES = [
  REDACTED_THINKING_OPEN,
  REDACTED_THINKING_CLOSE,
  MM_THINK_OPEN,
  MM_THINK_CLOSE,
  REDACTED_THINKING_ALT_CLOSE,
];

const REDACTED_THINKING_BLOCK =
  new RegExp(`${REDACTED_THINKING_OPEN}[\\s\\S]*?${REDACTED_THINKING_CLOSE}`, 'gi');
const REDACTED_THINKING_THINK_BLOCK =
  new RegExp(`${REDACTED_THINKING_OPEN}[\\s\\S]*?${REDACTED_THINKING_ALT_CLOSE}`, 'gi');
const MM_THINK_BLOCK = new RegExp(`${MM_THINK_OPEN}[\\s\\S]*?${MM_THINK_CLOSE}`, 'gi');
const REDACTED_THINKING_OPEN_TAIL = new RegExp(`${REDACTED_THINKING_OPEN}[\\s\\S]*$`, 'gi');
const MM_THINK_OPEN_TAIL = new RegExp(`${MM_THINK_OPEN}[\\s\\S]*$`, 'gi');

/**
 * Strips MiniMax interleaved thinking blocks from model output.
 * Without reasoning_split / Together reasoning separation, M-series models
 * may embed reasoning in content behind these wrappers.
 */
export function stripRedactedThinking(content: string): string {
  return content
    .replace(REDACTED_THINKING_BLOCK, '')
    .replace(REDACTED_THINKING_THINK_BLOCK, '')
    .replace(MM_THINK_BLOCK, '')
    .trim();
}

function stripTrailingPartialTag(content: string): string {
  for (const tag of THINKING_TAG_PREFIXES) {
    for (let prefixLength = 1; prefixLength < tag.length; prefixLength += 1) {
      const prefix = tag.slice(0, prefixLength);
      if (content.endsWith(prefix)) {
        return content.slice(0, content.length - prefixLength);
      }
    }
  }
  return content;
}

/**
 * Like stripRedactedThinking but also removes incomplete thinking blocks and
 * partial tag prefixes still being streamed from the provider.
 */
export function stripRedactedThinkingIncludingPartial(content: string): string {
  const withoutClosedBlocks = content
    .replace(REDACTED_THINKING_BLOCK, '')
    .replace(REDACTED_THINKING_THINK_BLOCK, '')
    .replace(MM_THINK_BLOCK, '')
    .replace(REDACTED_THINKING_OPEN_TAIL, '')
    .replace(MM_THINK_OPEN_TAIL, '');

  return stripTrailingPartialTag(withoutClosedBlocks);
}

export interface IStreamingThinkingFilter {
  append: (chunk: string) => string;
  finalize: () => string;
}

/**
 * Incrementally strips leaked thinking wrappers from streamed model output.
 */
export function createStreamingThinkingFilter(): IStreamingThinkingFilter {
  let rawBuffer = '';
  let cleanBuffer = '';

  return {
    append(chunk: string): string {
      if (!chunk) {
        return '';
      }

      rawBuffer += chunk;
      const nextClean = stripRedactedThinkingIncludingPartial(rawBuffer);
      const delta = nextClean.slice(cleanBuffer.length);
      cleanBuffer = nextClean;
      return delta;
    },
    finalize(): string {
      const finalClean = stripRedactedThinking(rawBuffer);
      const delta = finalClean.slice(cleanBuffer.length);
      rawBuffer = finalClean;
      cleanBuffer = finalClean;
      return delta;
    },
  };
}
