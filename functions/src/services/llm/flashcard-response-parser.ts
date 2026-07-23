import * as functions from 'firebase-functions';
import { JsonSanitizer } from '../gemini/json-sanitizer';
import { stripRedactedThinking } from './llm-response-text-utils';

export interface IParsedFlashcardItem {
  term?: string;
  front: string;
  back: string;
  description?: string;
  frontHtml?: string;
  backHtml?: string;
  descriptionHtml?: string;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFlashcardArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return null;
  }

  for (const key of ['flashcards', 'cards', 'items', 'data']) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return null;
}

function closeOpenBrackets(text: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (const char of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      stack.pop();
    }
  }

  let result = text;
  if (inString) {
    result += '"';
  }
  while (stack.length > 0) {
    const open = stack.pop();
    result += open === '{' ? '}' : ']';
  }
  return result;
}

/**
 * Extract the first JSON array that looks like flashcard output (`[{...`, `[[`, or `["`).
 * Returns a possibly truncated slice when the closing bracket is missing.
 */
export function extractBalancedJsonArray(text: string): string | null {
  const startMatch = /\[\s*[{["]/.exec(text);
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const start = startMatch.index;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

/** Close truncated JSON arrays/objects/strings so JSON.parse can succeed. */
export function repairTruncatedJsonArray(raw: string): string {
  let text = raw.trim();
  if (!text.startsWith('[')) {
    return text;
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = closeOpenBrackets(text.replace(/,\s*$/, ''));
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return candidate;
      }
    } catch {
      // trim back to a prior complete object/array boundary
    }

    const objectEnd = text.lastIndexOf('}');
    const comma = text.lastIndexOf(',');
    const cut = Math.max(objectEnd, comma);
    if (cut <= 0) {
      return closeOpenBrackets(text);
    }

    if (objectEnd >= comma) {
      text = text.slice(0, objectEnd + 1);
    } else {
      text = text.slice(0, comma);
    }
  }

  return closeOpenBrackets(text);
}

function tryParseJson(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function tryParseArrayCandidate(candidate: string): unknown[] | null {
  const variants = [
    candidate,
    JsonSanitizer.sanitizeJsonText(candidate),
    JsonSanitizer.applyComprehensiveCleanup(
      JsonSanitizer.sanitizeJsonText(candidate)
    ),
    JsonSanitizer.applyStateBased(
      JsonSanitizer.applyComprehensiveCleanup(
        JsonSanitizer.sanitizeJsonText(candidate)
      )
    ),
    repairTruncatedJsonArray(candidate),
    repairTruncatedJsonArray(JsonSanitizer.sanitizeJsonText(candidate)),
    repairTruncatedJsonArray(
      JsonSanitizer.applyComprehensiveCleanup(
        JsonSanitizer.sanitizeJsonText(candidate)
      )
    ),
  ];

  let best: unknown[] | null = null;
  for (const variant of variants) {
    const parsed = tryParseJson(variant);
    const array = asFlashcardArray(parsed);
    if (array && array.length > 0 && (!best || array.length > best.length)) {
      best = array;
    }
  }

  // Noisy fallback strategies only after structural repair candidates fail.
  if (!best || best.length < 10) {
    const repaired = repairTruncatedJsonArray(
      JsonSanitizer.applyStateBased(
        JsonSanitizer.applyComprehensiveCleanup(
          JsonSanitizer.sanitizeJsonText(candidate)
        )
      )
    );
    try {
      const fallback = JsonSanitizer.tryFallbackParsing(repaired);
      const array = asFlashcardArray(fallback);
      if (array && array.length > 0 && (!best || array.length > best.length)) {
        best = array;
      }
    } catch {
      // ignore
    }
  }

  return best;
}

function normalizeFlashcardItem(
  item: unknown,
  index: number
): IParsedFlashcardItem {
  if (!isRecord(item)) {
    throw new Error(`Invalid flashcard at index ${index}: expected object`);
  }

  const front = typeof item.front === 'string' ? item.front : '';
  const back = typeof item.back === 'string' ? item.back : '';
  if (!front || !back) {
    throw new Error(
      `Invalid flashcard at index ${index}: missing front or back`
    );
  }

  return {
    term: typeof item.term === 'string' ? item.term : undefined,
    front,
    back,
    description:
      typeof item.description === 'string' ? item.description : undefined,
    frontHtml: typeof item.frontHtml === 'string' ? item.frontHtml : undefined,
    backHtml: typeof item.backHtml === 'string' ? item.backHtml : undefined,
    descriptionHtml:
      typeof item.descriptionHtml === 'string'
        ? item.descriptionHtml
        : undefined,
  };
}

/**
 * Parse model flashcard output into a card array.
 * Tolerates thinking wrappers, fences, object wrappers, and lightly truncated JSON.
 */
export function parseFlashcardsJson(raw: string): IParsedFlashcardItem[] {
  const cleaned = stripCodeFences(stripRedactedThinking(raw.trim()));
  const candidates: string[] = [cleaned];

  const balanced = extractBalancedJsonArray(cleaned);
  if (balanced) {
    candidates.push(balanced);
  }

  const objectMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objectMatch?.[1]) {
    candidates.push(objectMatch[1]);
  }

  // Prefer the largest successfully parsed array so truncation repair does not
  // win over a fuller sanitize/parse path.
  let best: unknown[] | null = null;
  for (const candidate of candidates) {
    const array = tryParseArrayCandidate(candidate);
    if (array && (!best || array.length > best.length)) {
      best = array;
    }
  }

  if (best) {
    return best.map((item, index) => normalizeFlashcardItem(item, index));
  }

  functions.logger.warn('Failed to parse flashcard JSON response', {
    responseLength: raw.length,
    responsePreview: raw.slice(0, 400),
    responseTail: raw.slice(-400),
  });

  throw new Error(
    'Could not extract a valid JSON array from OpenRouter flashcard response'
  );
}
