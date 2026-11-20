import { iterateSearchTokens } from './searchTokenizer';
import type { ISearchSnippetSegment } from './searchTypes';

const CONTEXT_CHARS = 60;

function snapToWordStart(text: string, position: number): number {
  if (position <= 0) return 0;
  const space = text.indexOf(' ', position);
  return space === -1 || space - position > 20 ? position : space + 1;
}

function snapToWordEnd(text: string, position: number): number {
  if (position >= text.length) return text.length;
  const space = text.lastIndexOf(' ', position);
  return space === -1 || position - space > 20 ? position : space;
}

/**
 * Passage around the first place one of `anchorTerms` occurs in `text`, split
 * into plain and highlighted segments; every one of `matchedTerms` inside the
 * passage is highlighted. Returns null when no anchor term occurs.
 */
export function buildSearchSnippet(
  text: string,
  matchedTerms: ReadonlySet<string>,
  anchorTerms: ReadonlySet<string> = matchedTerms,
): ISearchSnippetSegment[] | null {
  let firstStart = -1;
  let firstEnd = -1;
  for (const token of iterateSearchTokens(text)) {
    if (anchorTerms.has(token.term)) {
      firstStart = token.start;
      firstEnd = token.end;
      break;
    }
  }
  if (firstStart === -1) {
    return null;
  }

  const windowStart = snapToWordStart(text, firstStart - CONTEXT_CHARS);
  const windowEnd = snapToWordEnd(text, firstEnd + CONTEXT_CHARS);
  const passage = text.slice(windowStart, windowEnd);

  // Overlapping pair terms of unspaced scripts merge into one highlight.
  const ranges: Array<[number, number]> = [];
  for (const token of iterateSearchTokens(passage)) {
    if (!matchedTerms.has(token.term)) continue;
    const last = ranges[ranges.length - 1];
    if (last && token.start <= last[1]) {
      last[1] = Math.max(last[1], token.end);
    } else {
      ranges.push([token.start, token.end]);
    }
  }

  const segments: ISearchSnippetSegment[] = [];
  const push = (value: string, highlighted: boolean) => {
    if (value) segments.push({ text: value, highlighted });
  };
  let cursor = 0;
  push(windowStart > 0 ? '…' : '', false);
  for (const [start, end] of ranges) {
    push(passage.slice(cursor, start), false);
    push(passage.slice(start, end), true);
    cursor = end;
  }
  push(passage.slice(cursor), false);
  push(windowEnd < text.length ? '…' : '', false);
  return segments;
}
