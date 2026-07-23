import { z } from 'zod';
import { JsonSanitizer } from '../gemini/json-sanitizer';
import type { IParsedFlashcardItem } from '../llm/flashcard-response-parser';
import { buildIndexBatches, mapWithConcurrency } from '../llm/concurrency';
import { normalizeVocabularyTerm } from './learned-vocabulary';
import { PLANNED_FLASHCARD_COUNT } from './flashcard-types';

export { mapWithConcurrency };

export const FLASHCARD_BATCH_SIZE = 3;
export const FLASHCARD_BATCH_MAX_SIZE = 3;
export const FLASHCARD_BATCH_CONCURRENCY = 2;

export const flashcardTermPlanSchema = z.object({
  term: z.string().min(1),
  hint: z.string().optional(),
});

export const flashcardPlanResponseSchema = z.object({
  terms: z.array(flashcardTermPlanSchema).min(1).max(PLANNED_FLASHCARD_COUNT + 4),
});

export const flashcardBatchCardSchema = z.object({
  index: z.number().int().min(0),
  term: z.string().optional(),
  front: z.string().min(1),
  back: z.string().min(1),
  description: z.string().optional(),
  frontHtml: z.string().optional(),
  backHtml: z.string().optional(),
  descriptionHtml: z.string().optional(),
});

export const flashcardBatchExpandResponseSchema = z.object({
  cards: z.array(flashcardBatchCardSchema).min(1),
});

export type IFlashcardTermPlan = z.infer<typeof flashcardTermPlanSchema>;
export type IFlashcardPlanResponse = z.infer<typeof flashcardPlanResponseSchema>;
export type IFlashcardBatchExpandResponse = z.infer<typeof flashcardBatchExpandResponseSchema>;
export type IFlashcardBatchCard = z.infer<typeof flashcardBatchCardSchema>;

function sanitizeAndParseJson(raw: string): unknown {
  let cleaned = JsonSanitizer.initialCleanup(raw);
  cleaned = JsonSanitizer.sanitizeJsonText(cleaned);
  cleaned = JsonSanitizer.applyComprehensiveCleanup(cleaned);
  cleaned = JsonSanitizer.applyStateBased(cleaned);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    JsonSanitizer.logParsingError(error, raw, cleaned);
    return JsonSanitizer.tryFallbackParsing(cleaned);
  }
}

export function parseFlashcardPlanResponse(raw: string): IFlashcardPlanResponse {
  const parsed = sanitizeAndParseJson(raw);
  return flashcardPlanResponseSchema.parse(parsed);
}

export function parseFlashcardBatchExpandResponse(raw: string): IFlashcardBatchExpandResponse {
  const parsed = sanitizeAndParseJson(raw);
  return flashcardBatchExpandResponseSchema.parse(parsed);
}

export function buildFlashcardIndexBatches(cardCount: number): number[][] {
  return buildIndexBatches(cardCount, FLASHCARD_BATCH_SIZE, FLASHCARD_BATCH_MAX_SIZE);
}

export function normalizePlanTermIdentity(term: string, isLanguageLearning: boolean): string {
  if (isLanguageLearning) {
    return normalizeVocabularyTerm(term);
  }
  return term.trim().toLowerCase();
}

export function filterFlashcardTermPlans(
  terms: IFlashcardTermPlan[],
  excludedNormalized: ReadonlySet<string>,
  isLanguageLearning: boolean
): IFlashcardTermPlan[] {
  const seen = new Set<string>();
  const filtered: IFlashcardTermPlan[] = [];

  for (const entry of terms) {
    const trimmed = entry.term.trim();
    if (!trimmed) {
      continue;
    }
    const identity = normalizePlanTermIdentity(trimmed, isLanguageLearning);
    if (!identity || seen.has(identity) || excludedNormalized.has(identity)) {
      continue;
    }
    seen.add(identity);
    filtered.push({ term: trimmed, ...(entry.hint?.trim() ? { hint: entry.hint.trim() } : {}) });
  }

  return filtered;
}

export function buildLearnedTermSet(learnedTerms: readonly string[]): Set<string> {
  return new Set(
    learnedTerms
      .map((term) => normalizeVocabularyTerm(term))
      .filter((term) => term.length > 0)
  );
}

export function mergeFlashcardBatchResponses(
  plannedTerms: readonly string[],
  batchResponses: IFlashcardBatchExpandResponse[],
  isLanguageLearning: boolean
): IParsedFlashcardItem[] {
  const cardsByIndex = new Map<number, IParsedFlashcardItem>();

  for (const batch of batchResponses) {
    for (const card of batch.cards) {
      if (cardsByIndex.has(card.index)) {
        throw new Error(`Duplicate flashcard batch result for index ${card.index}`);
      }
      cardsByIndex.set(card.index, toParsedFlashcardItem(card, isLanguageLearning));
    }
  }

  const merged: IParsedFlashcardItem[] = [];
  for (let index = 0; index < plannedTerms.length; index += 1) {
    const card = cardsByIndex.get(index);
    if (!card) {
      throw new Error(`Missing flashcard for slot index ${index}`);
    }

    const expectedTerm = plannedTerms[index]?.trim() ?? '';
    if (isLanguageLearning) {
      const expectedIdentity = normalizePlanTermIdentity(expectedTerm, true);
      const actualIdentity = normalizePlanTermIdentity(card.term ?? '', true);
      if (expectedIdentity && actualIdentity !== expectedIdentity) {
        throw new Error(
          `Flashcard index ${index} term mismatch: expected "${expectedTerm}", got "${card.term ?? ''}"`
        );
      }
    }

    merged.push(card);
  }

  return merged;
}

function toParsedFlashcardItem(
  card: IFlashcardBatchCard,
  isLanguageLearning: boolean
): IParsedFlashcardItem {
  const term = card.term?.trim();
  const item: IParsedFlashcardItem = {
    front: card.front.trim(),
    back: card.back.trim(),
    ...(card.description?.trim() ? { description: card.description.trim() } : {}),
    ...(card.frontHtml?.trim() ? { frontHtml: card.frontHtml.trim() } : {}),
    ...(card.backHtml?.trim() ? { backHtml: card.backHtml.trim() } : {}),
    ...(card.descriptionHtml?.trim() ? { descriptionHtml: card.descriptionHtml.trim() } : {}),
  };

  if (isLanguageLearning) {
    if (!term) {
      throw new Error(`Flashcard index ${card.index} is missing term`);
    }
    item.term = term;
  } else if (term) {
    item.term = term;
  }

  return item;
}

export function cardMatchesLearnedTerm(
  card: IParsedFlashcardItem,
  learnedSet: ReadonlySet<string>,
  isLanguageLearning: boolean
): boolean {
  if (learnedSet.size === 0) {
    return false;
  }

  if (isLanguageLearning) {
    const normalized = normalizePlanTermIdentity(card.term ?? '', true);
    return normalized.length > 0 && learnedSet.has(normalized);
  }

  const frontNormalized = card.front.trim().toLowerCase();
  return frontNormalized.length > 0 && learnedSet.has(frontNormalized);
}
