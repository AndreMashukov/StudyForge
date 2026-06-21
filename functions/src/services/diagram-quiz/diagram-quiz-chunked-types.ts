import { z } from 'zod';
import { JsonSanitizer } from '../gemini/json-sanitizer';
import type { GeminiDiagramQuizResponse } from '../gemini';

export const DEFAULT_DIAGRAM_QUIZ_QUESTION_COUNT = 5;
export const DIAGRAM_BATCH_SIZE = 2;
export const DIAGRAM_BATCH_MAX_SIZE = 3;
export const DIAGRAM_BATCH_CONCURRENCY = 2;

const knowledgeSchema = z.object({
  subjectName: z.string().min(1),
  knowledgeDomainName: z.string().min(1),
  topicTags: z.array(z.string().min(1)).min(1).max(5),
});

export const diagramQuizQuestionPlanSchema = z.object({
  question: z.string().min(1),
  correctAnswer: z.number().int().min(0).max(3),
  optionPlans: z.array(z.string().min(1)).length(4),
  explanation: z.string().min(1),
  hint: z.string().min(1),
  knowledge: knowledgeSchema,
});

export const diagramQuizQuestionPlanResponseSchema = z.object({
  title: z.string().min(1),
  questions: z.array(diagramQuizQuestionPlanSchema).min(1).max(8),
});

export const diagramQuizDiagramBatchResponseSchema = z.object({
  questions: z.array(
    z.object({
      index: z.number().int().min(0),
      diagrams: z.array(z.string().min(1)).length(4),
    })
  ).min(1),
});

export type IDiagramQuizQuestionPlan = z.infer<typeof diagramQuizQuestionPlanSchema>;
export type IDiagramQuizQuestionPlanResponse = z.infer<typeof diagramQuizQuestionPlanResponseSchema>;
export type IDiagramQuizDiagramBatchResponse = z.infer<typeof diagramQuizDiagramBatchResponseSchema>;

export function assertFourStringTuple(values: readonly string[], label: string): [string, string, string, string] {
  if (values.length !== 4 || values.some((value) => !value)) {
    throw new Error(`${label} must contain exactly 4 non-empty strings`);
  }
  return [values[0], values[1], values[2], values[3]];
}

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

export function parseDiagramQuizQuestionPlanResponse(raw: string): IDiagramQuizQuestionPlanResponse {
  const parsed = sanitizeAndParseJson(raw);
  return diagramQuizQuestionPlanResponseSchema.parse(parsed);
}

export function parseDiagramQuizDiagramBatchResponse(raw: string): IDiagramQuizDiagramBatchResponse {
  const parsed = sanitizeAndParseJson(raw);
  return diagramQuizDiagramBatchResponseSchema.parse(parsed);
}

/** Split question indexes into batches of 2, merging a lone remainder into the previous batch when possible. */
export function buildDiagramQuestionBatches(questionCount: number): number[][] {
  if (questionCount <= 0) {
    return [];
  }

  const batches: number[][] = [];
  let index = 0;

  while (index < questionCount) {
    const remaining = questionCount - index;
    let batchSize = Math.min(DIAGRAM_BATCH_SIZE, remaining);

    if (remaining === 1 && batches.length > 0) {
      const previous = batches[batches.length - 1];
      if (previous.length < DIAGRAM_BATCH_MAX_SIZE) {
        previous.push(index);
        break;
      }
    }

    if (remaining === 3 && batchSize === DIAGRAM_BATCH_SIZE) {
      batchSize = DIAGRAM_BATCH_MAX_SIZE;
    }

    const batch: number[] = [];
    for (let offset = 0; offset < batchSize; offset += 1) {
      batch.push(index + offset);
    }
    batches.push(batch);
    index += batchSize;
  }

  return batches;
}

export function mergeQuestionPlansWithDiagramBatches(
  planResponse: IDiagramQuizQuestionPlanResponse,
  batchResponses: IDiagramQuizDiagramBatchResponse[]
): GeminiDiagramQuizResponse {
  const diagramsByIndex = new Map<number, [string, string, string, string]>();

  for (const batch of batchResponses) {
    for (const item of batch.questions) {
      if (diagramsByIndex.has(item.index)) {
        throw new Error(`Duplicate diagram batch result for question index ${item.index}`);
      }
      diagramsByIndex.set(
        item.index,
        assertFourStringTuple(item.diagrams, `Question ${item.index} diagrams`)
      );
    }
  }

  const questions = planResponse.questions.map((plan, questionIndex) => {
    const diagrams = diagramsByIndex.get(questionIndex);
    if (!diagrams) {
      throw new Error(`Missing diagrams for question index ${questionIndex}`);
    }

    return {
      question: plan.question,
      diagrams: [...diagrams],
      correctAnswer: plan.correctAnswer,
      explanation: plan.explanation,
      hint: plan.hint,
      knowledge: plan.knowledge,
    };
  });

  return {
    title: planResponse.title,
    questions,
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, itemIndex: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
