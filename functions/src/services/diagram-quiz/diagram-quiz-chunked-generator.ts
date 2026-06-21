import { logger } from 'firebase-functions/v2';
import type { ScrapedContent } from '@shared-types';
import { DiagramQuizPromptBuilder } from '../gemini/prompt-builder';
import { GeminiService, type GeminiDiagramQuizResponse } from '../gemini';
import { generateExternalProviderText, resolveTextRoute } from '../llm/llm-text-runner';
import type { TextRouteContext } from '../llm/llm-text-runner';
import {
  DEFAULT_DIAGRAM_QUIZ_QUESTION_COUNT,
  DIAGRAM_BATCH_CONCURRENCY,
  assertFourStringTuple,
  buildDiagramQuestionBatches,
  mergeQuestionPlansWithDiagramBatches,
  mapWithConcurrency,
  parseDiagramQuizDiagramBatchResponse,
  parseDiagramQuizQuestionPlanResponse,
  type IDiagramQuizDiagramBatchResponse,
  type IDiagramQuizQuestionPlan,
  type IDiagramQuizQuestionPlanResponse,
} from './diagram-quiz-chunked-types';

function toBatchQuestion(plan: IDiagramQuizQuestionPlan, index: number) {
  return {
    index,
    question: plan.question,
    correctAnswer: plan.correctAnswer,
    optionPlans: assertFourStringTuple(plan.optionPlans, `Question ${index} optionPlans`),
    explanation: plan.explanation,
  };
}

const QUESTION_PLAN_MAX_OUTPUT_TOKENS = 8192;
const DIAGRAM_BATCH_MAX_OUTPUT_TOKENS = 8192;

/**
 * Two-phase diagram quiz generation for external LLM providers:
 * 1) compact question plans, 2) Mermaid diagrams in small parallel batches.
 * Gemini direct routing keeps the existing one-shot generator.
 */
export async function generateDiagramQuizChunked(
  content: ScrapedContent,
  additionalPrompt?: string
): Promise<GeminiDiagramQuizResponse> {
  const ctx = await resolveTextRoute('diagramQuiz', 'diagramQuiz');
  if (!ctx.usesExternalProvider) {
    return GeminiService.generateDiagramQuiz(content, additionalPrompt);
  }

  const questionCount = DEFAULT_DIAGRAM_QUIZ_QUESTION_COUNT;
  const randomCorrectAnswers = DiagramQuizPromptBuilder.generateRandomCorrectAnswers(questionCount);
  const planPrompt = DiagramQuizPromptBuilder.buildDiagramQuizQuestionPlanPrompt(
    content,
    additionalPrompt,
    randomCorrectAnswers,
    questionCount
  );

  logger.info('Generating diagram quiz question plans', {
    providerType: ctx.resolution.route.providerType,
    model: ctx.resolution.route.model,
    questionCount,
  });

  const planText = await generateExternalProviderText(
    ctx,
    planPrompt,
    {
      model: ctx.resolution.route.model,
      temperature: 0.4,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: QUESTION_PLAN_MAX_OUTPUT_TOKENS,
    },
    'Diagram quiz question plans generated via external provider'
  );

  const planResponse = parseDiagramQuizQuestionPlanResponse(planText);
  if (planResponse.questions.length < 1) {
    throw new Error('Diagram quiz question planning returned no questions');
  }

  const batches = buildDiagramQuestionBatches(planResponse.questions.length);
  logger.info('Generating diagram quiz Mermaid batches', {
    questionCount: planResponse.questions.length,
    batchCount: batches.length,
    batches,
    concurrency: DIAGRAM_BATCH_CONCURRENCY,
  });

  const batchResponses = await mapWithConcurrency(
    batches,
    DIAGRAM_BATCH_CONCURRENCY,
    async (questionIndexes, batchOrder) =>
      generateDiagramBatchWithRetry({
        ctx,
        content,
        planResponse,
        questionIndexes,
        batchOrder,
      })
  );

  return mergeQuestionPlansWithDiagramBatches(planResponse, batchResponses);
}

async function generateDiagramBatchWithRetry(params: {
  ctx: TextRouteContext;
  content: ScrapedContent;
  planResponse: IDiagramQuizQuestionPlanResponse;
  questionIndexes: number[];
  batchOrder: number;
}): Promise<IDiagramQuizDiagramBatchResponse> {
  try {
    return await generateDiagramBatch({ ...params, strict: false });
  } catch (firstError) {
    logger.warn('Diagram quiz batch failed; retrying with strict prompt', {
      batchOrder: params.batchOrder,
      questionIndexes: params.questionIndexes,
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });
    return generateDiagramBatch({ ...params, strict: true });
  }
}

async function generateDiagramBatch(params: {
  ctx: TextRouteContext;
  content: ScrapedContent;
  planResponse: IDiagramQuizQuestionPlanResponse;
  questionIndexes: number[];
  batchOrder: number;
  strict: boolean;
}): Promise<IDiagramQuizDiagramBatchResponse> {
  const { ctx, content, planResponse, questionIndexes, batchOrder, strict } = params;
  const questions = questionIndexes.map((index) => {
    const plan = planResponse.questions[index];
    if (!plan) {
      throw new Error(`Question plan missing for index ${index}`);
    }
    return toBatchQuestion(plan, index);
  });

  const prompt = DiagramQuizPromptBuilder.buildDiagramQuizDiagramBatchPrompt({
    content,
    title: planResponse.title,
    questions,
    strict,
  });

  const text = await generateExternalProviderText(
    ctx,
    prompt,
    {
      model: ctx.resolution.route.model,
      temperature: strict ? 0.2 : 0.35,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: DIAGRAM_BATCH_MAX_OUTPUT_TOKENS,
    },
    strict
      ? 'Diagram quiz diagram batch retry via external provider'
      : 'Diagram quiz diagram batch via external provider'
  );

  const parsed = parseDiagramQuizDiagramBatchResponse(text);
  for (const index of questionIndexes) {
    if (!parsed.questions.some((item) => item.index === index)) {
      throw new Error(`Diagram batch ${batchOrder} missing question index ${index}`);
    }
  }

  return parsed;
}
