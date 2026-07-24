/** MiniMax image_generation API rejects prompts >= 1500 characters. */
export const MINIMAX_IMAGE_PROMPT_MAX_LENGTH = 1499;

/** Max brief length so compact wrapper + brief stays under the image prompt cap. */
export const MINIMAX_SLIDE_BRIEF_MAX_CHARS = 950;

export function truncateAtWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const slice = trimmed.slice(0, maxLength);
  const breakAt = Math.max(
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf(' ')
  );

  if (breakAt >= Math.floor(maxLength * 0.5)) {
    return `${slice.slice(0, breakAt).trimEnd()}…`;
  }

  return `${slice.trimEnd()}…`;
}

export function fitMiniMaxImagePrompt(prompt: string): string {
  return truncateAtWordBoundary(prompt, MINIMAX_IMAGE_PROMPT_MAX_LENGTH);
}

const BRIEF_START_MARKER = 'following detailed specification:';
const BRIEF_END_MARKER = 'important rendering rules:';

export function extractSlideImageBriefFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const startIdx = lower.indexOf(BRIEF_START_MARKER);
  const endIdx = lower.indexOf(BRIEF_END_MARKER);
  if (startIdx < 0 || endIdx <= startIdx) {
    return null;
  }

  return prompt.slice(startIdx + BRIEF_START_MARKER.length, endIdx).trim() || null;
}
