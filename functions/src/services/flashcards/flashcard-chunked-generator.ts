import { logger } from 'firebase-functions/v2';
import {
  FlashcardPromptBuilder,
  type FlashcardPromptOptions,
} from '../gemini/prompt-builder/flashcard-prompt-builder';
import { generateExternalProviderText, resolveTextRoute } from '../llm/llm-text-runner';
import type { TextRouteContext } from '../llm/llm-text-runner';
import type { IParsedFlashcardItem } from '../llm/flashcard-response-parser';
import { PLANNED_FLASHCARD_COUNT } from './flashcard-types';
import {
  FLASHCARD_BATCH_CONCURRENCY,
  FLASHCARD_BATCH_SIZE,
  buildLearnedTermSet,
  filterFlashcardTermPlans,
  mergeFlashcardBatchResponses,
  mapWithConcurrency,
  normalizePlanTermIdentity,
  parseFlashcardBatchExpandResponse,
  parseFlashcardPlanResponse,
  type IFlashcardBatchExpandResponse,
  type IFlashcardTermPlan,
} from './flashcard-chunked-types';

const PLAN_MAX_OUTPUT_TOKENS = 8192;
const BATCH_MAX_OUTPUT_TOKENS = 12288;

/** Structured flashcard calls do not benefit from chain-of-thought; keep latency low. */
const FLASHCARD_NO_REASONING = { disableReasoning: true } as const;

export interface FlashcardChunkedGenerationParams {
  content: string;
  rules?: string;
  descriptionRules?: string;
  options?: FlashcardPromptOptions;
}

export interface FlashcardChunkedGenerationResult {
  flashcards: IParsedFlashcardItem[];
  plannedTerms: string[];
  learnedTerms: string[];
}

export interface FlashcardSlotExpandParams extends FlashcardChunkedGenerationParams {
  slots: Array<{ index: number; term: string; hint?: string }>;
}

/**
 * Two-phase flashcard generation for all providers:
 * 1) compact term plan, 2) full cards in small parallel batches.
 */
export async function generateFlashcardsChunked(
  userId: string,
  params: FlashcardChunkedGenerationParams
): Promise<FlashcardChunkedGenerationResult> {
  const ctx = await resolveTextRoute(userId, 'flashcards', 'flashcards');
  const learnedTerms = params.options?.learnedTerms ?? [];
  const learnedSet = buildLearnedTermSet(learnedTerms);

  const plannedTerms = await planFlashcardTerms({
    ctx,
    ...params,
    termCount: PLANNED_FLASHCARD_COUNT,
    excludedNormalized: learnedSet,
    allowReplan: true,
  });

  const flashcards = await expandFlashcardSlots({
    ctx,
    ...params,
    slots: plannedTerms.map((term, index) => ({ index, term })),
  });

  return {
    flashcards,
    plannedTerms,
    learnedTerms,
  };
}

/** Expand specific slot indexes — used by repair to regenerate failed cards. */
export async function expandFlashcardSlotsForRepair(
  userId: string,
  params: FlashcardSlotExpandParams
): Promise<Map<number, IParsedFlashcardItem>> {
  const ctx = await resolveTextRoute(userId, 'flashcards', 'flashcard-slot-repair');
  const orderedSlots = params.slots.slice().sort((left, right) => left.index - right.index);
  const batches = buildSlotBatches(orderedSlots);

  const batchResponses = await mapWithConcurrency(
    batches,
    FLASHCARD_BATCH_CONCURRENCY,
    async (batchSlots, batchOrder) =>
      generateFlashcardBatchWithRetry({
        ctx,
        ...params,
        slots: batchSlots,
        batchOrder,
      })
  );

  const cardsByIndex = new Map<number, IParsedFlashcardItem>();
  for (const batch of batchResponses) {
    for (const card of batch.cards) {
      cardsByIndex.set(card.index, {
        ...(card.term?.trim() ? { term: card.term.trim() } : {}),
        front: card.front.trim(),
        back: card.back.trim(),
        ...(card.description?.trim() ? { description: card.description.trim() } : {}),
        ...(card.frontHtml?.trim() ? { frontHtml: card.frontHtml.trim() } : {}),
        ...(card.backHtml?.trim() ? { backHtml: card.backHtml.trim() } : {}),
        ...(card.descriptionHtml?.trim() ? { descriptionHtml: card.descriptionHtml.trim() } : {}),
      });
    }
  }

  for (const slot of orderedSlots) {
    if (!cardsByIndex.has(slot.index)) {
      throw new Error(`Flashcard slot repair missing index ${slot.index}`);
    }
  }

  return cardsByIndex;
}

/** Request replacement terms for specific slots during repair. */
export async function replanFlashcardReplacementTerms(
  userId: string,
  params: FlashcardChunkedGenerationParams & {
    needed: number;
    excludedTerms: string[];
  }
): Promise<string[]> {
  const ctx = await resolveTextRoute(userId, 'flashcards', 'flashcard-plan-replacement');
  const isLanguageLearning = Boolean(params.options?.isLanguageLearning);
  const learnedSet = buildLearnedTermSet(params.options?.learnedTerms ?? []);
  const excludedNormalized = new Set<string>(learnedSet);

  for (const term of params.excludedTerms) {
    const identity = normalizePlanTermIdentity(term, isLanguageLearning);
    if (identity) {
      excludedNormalized.add(identity);
    }
  }

  const prompt = FlashcardPromptBuilder.buildFlashcardPlanPrompt({
    content: params.content,
    rules: params.rules,
    options: params.options,
    termCount: params.needed,
    excludedTerms: params.excludedTerms,
  });

  const planText = await generateExternalProviderText(
    ctx,
    prompt,
    {
      model: ctx.resolution.route.model,
      temperature: 0.35,
      maxOutputTokens: PLAN_MAX_OUTPUT_TOKENS,
      ...FLASHCARD_NO_REASONING,
    },
    'Flashcard replacement term plan via provider'
  );

  const planResponse = parseFlashcardPlanResponse(planText);
  const filtered = filterFlashcardTermPlans(
    planResponse.terms,
    excludedNormalized,
    isLanguageLearning
  );

  if (filtered.length < params.needed) {
    throw new Error(
      `Flashcard replacement planning returned ${filtered.length} terms; need ${params.needed}`
    );
  }

  return filtered.slice(0, params.needed).map((entry) => entry.term);
}

async function planFlashcardTerms(params: {
  ctx: TextRouteContext;
  content: string;
  rules?: string;
  options?: FlashcardPromptOptions;
  termCount: number;
  excludedNormalized: ReadonlySet<string>;
  allowReplan: boolean;
}): Promise<string[]> {
  const { ctx, content, rules, options, termCount, excludedNormalized, allowReplan } = params;
  const isLanguageLearning = Boolean(options?.isLanguageLearning);

  logger.info('Generating flashcard term plan', {
    providerType: ctx.resolution.route.providerType,
    model: ctx.resolution.route.model,
    termCount,
    learnedExcludeCount: excludedNormalized.size,
  });

  const planPrompt = FlashcardPromptBuilder.buildFlashcardPlanPrompt({
    content,
    rules,
    options,
    termCount,
  });

  const planText = await generateExternalProviderText(
    ctx,
    planPrompt,
    {
      model: ctx.resolution.route.model,
      temperature: 0.4,
      maxOutputTokens: PLAN_MAX_OUTPUT_TOKENS,
      ...FLASHCARD_NO_REASONING,
    },
    'Flashcard term plan generated via provider'
  );

  const planResponse = parseFlashcardPlanResponse(planText);
  let filtered = filterFlashcardTermPlans(planResponse.terms, excludedNormalized, isLanguageLearning);

  if (filtered.length < termCount && allowReplan) {
    const needed = termCount - filtered.length;
    const alreadySelected = filtered.map((entry) => entry.term);
    logger.warn('Flashcard plan under target after learned filter; replanning replacements', {
      planned: filtered.length,
      needed,
    });

    const replacements = await replanFlashcardReplacementTermsInternal({
      ctx,
      content,
      rules,
      options,
      needed,
      excludedTerms: alreadySelected,
      excludedNormalized,
    });

    filtered = [
      ...filtered,
      ...replacements.map((term) => ({ term } satisfies IFlashcardTermPlan)),
    ];
  }

  if (filtered.length < termCount) {
    throw new Error(
      `Flashcard planning produced ${filtered.length} usable terms; need ${termCount}`
    );
  }

  return filtered.slice(0, termCount).map((entry) => entry.term);
}

async function replanFlashcardReplacementTermsInternal(params: {
  ctx: TextRouteContext;
  content: string;
  rules?: string;
  options?: FlashcardPromptOptions;
  needed: number;
  excludedTerms: string[];
  excludedNormalized: ReadonlySet<string>;
}): Promise<string[]> {
  const { ctx, content, rules, options, needed, excludedTerms, excludedNormalized } = params;
  const isLanguageLearning = Boolean(options?.isLanguageLearning);

  const prompt = FlashcardPromptBuilder.buildFlashcardPlanPrompt({
    content,
    rules,
    options,
    termCount: needed,
    excludedTerms,
  });

  const planText = await generateExternalProviderText(
    ctx,
    prompt,
    {
      model: ctx.resolution.route.model,
      temperature: 0.35,
      maxOutputTokens: PLAN_MAX_OUTPUT_TOKENS,
      ...FLASHCARD_NO_REASONING,
    },
    'Flashcard replacement term plan via provider'
  );

  const planResponse = parseFlashcardPlanResponse(planText);
  const filtered = filterFlashcardTermPlans(
    planResponse.terms,
    excludedNormalized,
    isLanguageLearning
  );

  if (filtered.length < needed) {
    throw new Error(
      `Flashcard replacement planning returned ${filtered.length} terms; need ${needed}`
    );
  }

  return filtered.slice(0, needed).map((entry) => entry.term);
}

async function expandFlashcardSlots(params: {
  ctx: TextRouteContext;
  content: string;
  rules?: string;
  descriptionRules?: string;
  options?: FlashcardPromptOptions;
  slots: Array<{ index: number; term: string; hint?: string }>;
}): Promise<IParsedFlashcardItem[]> {
  const { ctx, slots } = params;
  if (slots.length === 0) {
    return [];
  }

  const orderedSlots = slots.slice().sort((left, right) => left.index - right.index);
  const plannedTerms = orderedSlots.map((slot) => slot.term);
  const batches = buildSlotBatches(orderedSlots);

  logger.info('Generating flashcard expand batches', {
    slotCount: orderedSlots.length,
    batchCount: batches.length,
    concurrency: FLASHCARD_BATCH_CONCURRENCY,
  });

  const batchResponses = await mapWithConcurrency(
    batches,
    FLASHCARD_BATCH_CONCURRENCY,
    async (batchSlots, batchOrder) =>
      generateFlashcardBatchWithRetry({
        ctx,
        ...params,
        slots: batchSlots,
        batchOrder,
      })
  );

  return mergeFlashcardBatchResponses(
    plannedTerms,
    batchResponses,
    Boolean(params.options?.isLanguageLearning)
  );
}

function buildSlotBatches<T>(slots: T[]): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < slots.length; index += FLASHCARD_BATCH_SIZE) {
    batches.push(slots.slice(index, index + FLASHCARD_BATCH_SIZE));
  }
  return batches;
}

async function generateFlashcardBatchWithRetry(params: {
  ctx: TextRouteContext;
  content: string;
  rules?: string;
  descriptionRules?: string;
  options?: FlashcardPromptOptions;
  slots: Array<{ index: number; term: string; hint?: string }>;
  batchOrder: number;
}): Promise<IFlashcardBatchExpandResponse> {
  try {
    return await generateFlashcardBatch({ ...params, strict: false });
  } catch (firstError) {
    logger.warn('Flashcard expand batch failed; retrying with strict prompt', {
      batchOrder: params.batchOrder,
      indexes: params.slots.map((slot) => slot.index),
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });
    return generateFlashcardBatch({ ...params, strict: true });
  }
}

async function generateFlashcardBatch(params: {
  ctx: TextRouteContext;
  content: string;
  rules?: string;
  descriptionRules?: string;
  options?: FlashcardPromptOptions;
  slots: Array<{ index: number; term: string; hint?: string }>;
  batchOrder: number;
  strict: boolean;
}): Promise<IFlashcardBatchExpandResponse> {
  const { ctx, content, rules, descriptionRules, options, slots, batchOrder, strict } = params;

  const prompt = FlashcardPromptBuilder.buildFlashcardBatchExpandPrompt({
    content,
    rules,
    descriptionRules,
    options,
    slots,
    strict,
  });

  const text = await generateExternalProviderText(
    ctx,
    prompt,
    {
      model: ctx.resolution.route.model,
      temperature: strict ? 0.2 : 0.35,
      maxOutputTokens: BATCH_MAX_OUTPUT_TOKENS,
      ...FLASHCARD_NO_REASONING,
    },
    strict
      ? 'Flashcard expand batch retry via provider'
      : 'Flashcard expand batch via provider'
  );

  const parsed = parseFlashcardBatchExpandResponse(text);
  for (const slot of slots) {
    if (!parsed.cards.some((card) => card.index === slot.index)) {
      throw new Error(`Flashcard batch ${batchOrder} missing slot index ${slot.index}`);
    }
  }

  return parsed;
}
