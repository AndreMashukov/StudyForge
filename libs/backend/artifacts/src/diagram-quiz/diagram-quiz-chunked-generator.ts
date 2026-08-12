import { logger } from 'firebase-functions/v2';
import type { ScrapedContent } from '@shared-types';
import { DiagramQuizPromptBuilder } from '@study-forge/backend-llm/llm/prompt-builder';
import {
  generateDiagramQuizDirect,
  type DiagramQuizGenerationResponse,
} from '@study-forge/backend-llm/llm';
import { generateExternalProviderText, resolveTextRoute } from '@study-forge/backend-llm/llm/llm-text-runner';
import type { TextRouteContext } from '@study-forge/backend-llm/llm/llm-text-runner';
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

// Thinking models (e.g. Together MiniMax-M3) spend a large share of max_tokens on
// reasoning before emitting JSON. 8k was enough for content-only models but truncates
// after reasoning with finish_reason=length and an empty payload.
const QUESTION_PLAN_MAX_OUTPUT_TOKENS = 32768;
const DIAGRAM_BATCH_MAX_OUTPUT_TOKENS = 32768;

/**
 * Two-phase diagram quiz generation for external LLM providers:
 * 1) compact question plans, 2) Mermaid diagrams in small parallel batches.
 * Gemini direct routing keeps the existing one-shot generator.
 */
export async function generateDiagramQuizChunked(
  userId: string,
  content: ScrapedContent,
  additionalPrompt?: string
): Promise<DiagramQuizGenerationResponse> {
  const ctx = await resolveTextRoute(userId, 'diagramQuiz', 'diagramQuiz');
  if (!ctx.usesExternalProvider) {
    return generateDiagramQuizDirect(
      content,
      additionalPrompt,
      ctx.resolution.route.model,
    );
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
      maxOutputTokens: QUESTION_PLAN_MAX_OUTPUT_TOKENS,
    },
    'Diagram quiz question plans generated via external provider',
    { profile: 'structuredArtifact' },
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
      ...(strict ? { temperature: 0.2 } : {}),
      maxOutputTokens: DIAGRAM_BATCH_MAX_OUTPUT_TOKENS,
    },
    strict
      ? 'Diagram quiz diagram batch retry via external provider'
      : 'Diagram quiz diagram batch via external provider',
    { profile: 'structuredArtifact' },
  );

  const parsed = parseDiagramQuizDiagramBatchResponse(text);
  for (const index of questionIndexes) {
    if (!parsed.questions.some((item) => item.index === index)) {
      throw new Error(`Diagram batch ${batchOrder} missing question index ${index}`);
    }
  }

  return parsed;
}
