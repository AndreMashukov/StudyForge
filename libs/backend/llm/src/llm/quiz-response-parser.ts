import * as functions from 'firebase-functions';
import { JsonSanitizer, type GeminiQuizResponse } from '../gemini';
import { stripRedactedThinking } from './llm-response-text-utils';

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/** Close truncated JSON objects/strings that providers sometimes return mid-object. */
export function repairTruncatedJsonObject(raw: string): string {
  let text = raw.trim();
  if (!text.startsWith('{')) {
    return text;
  }

  let inString = false;
  let escape = false;
  let braceDepth = 0;
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
    if (char === '{') {
      braceDepth += 1;
    } else if (char === '}') {
      braceDepth -= 1;
    }
  }

  if (inString) {
    text += '"';
  }
  while (braceDepth > 0) {
    text += '}';
    braceDepth -= 1;
  }
  return text;
}

/**
 * MiniMax M3 often returns quiz JSON without the outer `{` or with a bare title string:
 *   "Quiz Title",\n  "questions": [ ... ]
 *   "title": "Quiz Title",\n  "questions": [ ... ]
 */
export function repairQuizJsonEnvelope(raw: string): string {
  let text = raw.trim();

  const bareTitleMatch = text.match(
    /^"((?:\\.|[^"\\])*)"\s*,\s*"questions"\s*:\s*\[/
  );
  if (bareTitleMatch) {
    const title = bareTitleMatch[1];
    const remainder = text.slice(bareTitleMatch[0].length);
    text = `{"title":"${title}","questions":[${remainder}`;
  } else if (!text.startsWith('{') && /^"title"\s*:/.test(text)) {
    text = `{${text}`;
  } else if (!text.startsWith('{') && /"questions"\s*:\s*\[/.test(text)) {
    text = `{${text}`;
  }

  return repairTruncatedJsonObject(text);
}

/** Extract the first balanced top-level JSON object (avoids greedy `{...}` inner-question matches). */
export function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
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
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

function sanitizeQuizJsonText(text: string): string {
  let cleaned = JsonSanitizer.sanitizeJsonText(text);
  cleaned = JsonSanitizer.applyComprehensiveCleanup(cleaned);
  cleaned = JsonSanitizer.applyStateBased(cleaned);
  return cleaned;
}

function validateQuizStructure(parsed: unknown): asserts parsed is GeminiQuizResponse {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Quiz response must be a JSON object');
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.title !== 'string' || !record.title.trim()) {
    throw new Error('Missing title in quiz response');
  }
  if (!Array.isArray(record.questions) || record.questions.length === 0) {
    throw new Error('Missing questions array in quiz response');
  }
}

function buildQuizParseCandidates(raw: string): string[] {
  const stripped = stripRedactedThinking(stripCodeFences(raw)).trim();
  const repaired = repairQuizJsonEnvelope(stripped);
  const candidates = new Set<string>([stripped, repaired]);

  for (const base of [stripped, repaired]) {
    const extracted = extractBalancedJsonObject(base);
    if (extracted) {
      candidates.add(extracted);
      candidates.add(repairTruncatedJsonObject(extracted));
      candidates.add(sanitizeQuizJsonText(extracted));
      candidates.add(repairTruncatedJsonObject(sanitizeQuizJsonText(extracted)));
    }

    const sanitizedBase = sanitizeQuizJsonText(base);
    candidates.add(sanitizedBase);
    candidates.add(repairTruncatedJsonObject(sanitizedBase));
  }

  return [...candidates];
}

export function parseQuizJson(raw: string): GeminiQuizResponse {
  const candidates = buildQuizParseCandidates(raw);
  let lastError: unknown;
  let lastCleaned = '';

  for (const candidate of candidates) {
    if (!candidate.trim()) {
      continue;
    }
    lastCleaned = candidate;
    try {
      const parsed: unknown = JSON.parse(candidate);
      validateQuizStructure(parsed);
      functions.logger.info(`Parsed quiz with ${parsed.questions.length} questions`);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  JsonSanitizer.logParsingError(lastError, raw, lastCleaned);

  try {
    const fallback = JsonSanitizer.tryFallbackParsing(lastCleaned) as Record<string, unknown>;
    validateQuizStructure(fallback);
    return fallback as unknown as GeminiQuizResponse;
  } catch {
    throw new Error(`Failed to parse quiz JSON: ${lastError}`);
  }
}
