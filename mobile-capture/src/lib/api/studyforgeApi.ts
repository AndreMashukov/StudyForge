import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import type {
  CancelAgentTurnRequest,
  CancelAgentTurnResponse,
  StartAgentTurnRequest,
  ISuggestedAgentPrompt,
  StartAgentTurnResponse,
  CreateDocumentFromPastedTextRequest,
  CreateDocumentFromUrlRequest,
  CreateDocumentRequest,
  EvaluateScratchPadAnswerRequest,
  GenerateFlashcardsRequest,
  GenerateFromScreenshotRequest,
  GenerateQuizRequest,
  EvaluateDocumentNarratabilityResponse,
  QuoteDocumentNarrationResponse,
  RemoveDocumentNarrationResponse,
  StartDocumentNarrationRequest,
  StartDocumentNarrationResponse,
} from '@shared-types';
import {
  cancelAgentTurnResponseSchema,
  evaluateDocumentNarratabilityResponseSchema,
  NARRATION_PRICE_CHANGED_CODE,
  quoteDocumentNarrationResponseSchema,
  removeDocumentNarrationResponseSchema,
  startAgentTurnResponseSchema,
  listSuggestedAgentPromptsResponseSchema,
  startDocumentNarrationResponseSchema,
} from '@shared-types';
import { functions, waitForAppCheckReady } from '../firebase';
import { fetchDirectoryTreeFromFirestore } from './directoryTreeFirestore';
import {
  createDocumentResponseSchema,
  evaluateScratchPadAnswerResponseSchema,
  generateFromScreenshotResponseSchema,
  IEvaluateScratchPadAnswerResponse,
  IStartGenerationResponse,
  startGenerationResponseSchema,
  getDirectoryTreeResponseSchema,
  ICreateDocumentResponse,
  IGenerateFromScreenshotResponse,
  IGetDirectoryTreeResponse,
  parseCallableResponse,
} from './studyforgeApiSchemas';

async function callFunction<TRequest, TResponse>(
  functionName: string,
  data: TRequest,
  schema: z.ZodType<TResponse>,
  timeoutMs?: number,
): Promise<TResponse> {
  await waitForAppCheckReady();
  const callable = httpsCallable(
    functions,
    functionName,
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );
  const result = await callable(data);
  return parseCallableResponse(schema, result.data);
}

/**
 * Like `callFunction`, for response schemas from `@shared-types`, which use a
 * different Zod major version than this app.
 */
async function callSharedFunction<TResponse>(
  functionName: string,
  data: unknown,
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: TResponse } | { success: false };
  },
  timeoutMs?: number,
): Promise<TResponse> {
  await waitForAppCheckReady();
  const callable = httpsCallable(
    functions,
    functionName,
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );
  const result = await callable(data);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(`Invalid ${functionName} response`);
  }
  return parsed.data;
}

function isRecordWithMessage(
  value: unknown,
): value is { message?: string; code?: string } {
  return typeof value === 'object' && value !== null;
}

export async function getDirectoryTree(): Promise<IGetDirectoryTreeResponse> {
  const tree = await fetchDirectoryTreeFromFirestore();
  return parseCallableResponse(getDirectoryTreeResponseSchema, tree);
}

export async function createDocument(
  request: CreateDocumentRequest,
): Promise<ICreateDocumentResponse> {
  return callFunction('createDocument', request, createDocumentResponseSchema);
}

export async function generateFromScreenshot(
  request: GenerateFromScreenshotRequest,
): Promise<IGenerateFromScreenshotResponse> {
  return callFunction(
    'generateFromScreenshot',
    request,
    generateFromScreenshotResponseSchema,
    540_000,
  );
}

export async function createDocumentFromPastedText(
  request: CreateDocumentFromPastedTextRequest,
): Promise<IStartGenerationResponse> {
  return callFunction(
    'createDocumentFromPastedText',
    request,
    startGenerationResponseSchema,
    120_000,
  );
}

export async function createDocumentFromUrl(
  request: CreateDocumentFromUrlRequest,
): Promise<IStartGenerationResponse> {
  return callFunction(
    'createDocumentFromUrl',
    request,
    startGenerationResponseSchema,
    120_000,
  );
}

/** One-tap generation (decision 11): inherited and always-apply rules only. */
export async function generateQuiz(
  request: Pick<GenerateQuizRequest, 'documentIds' | 'directoryId'>,
): Promise<IStartGenerationResponse> {
  return callFunction(
    'generateQuiz',
    { ...request, ruleResolutionMode: 'inherit' },
    startGenerationResponseSchema,
    120_000,
  );
}

export async function generateFlashcards(
  request: Pick<GenerateFlashcardsRequest, 'documentIds' | 'directoryId'>,
): Promise<IStartGenerationResponse> {
  return callFunction(
    'generateFlashcards',
    { ...request, ruleResolutionMode: 'inherit' },
    startGenerationResponseSchema,
    120_000,
  );
}

export async function evaluateScratchPadAnswer(
  request: EvaluateScratchPadAnswerRequest,
): Promise<IEvaluateScratchPadAnswerResponse['data']> {
  const response = await callFunction(
    'evaluateScratchPadAnswerCallable',
    request,
    evaluateScratchPadAnswerResponseSchema,
    60_000,
  );
  return response.data;
}

/** Starts a durable agent turn; the reply arrives through the turn doc (ADR 010). */
export async function startAgentTurn(
  request: StartAgentTurnRequest,
): Promise<StartAgentTurnResponse> {
  return callSharedFunction(
    'startAgentTurn',
    request,
    startAgentTurnResponseSchema,
    30_000,
  );
}

/** Suggested agent prompts for the "/" menu (published agent blueprints, ADR 017). */
export async function listSuggestedAgentPrompts(): Promise<
  ISuggestedAgentPrompt[]
> {
  const response = await callSharedFunction(
    'listSuggestedAgentPrompts',
    {},
    listSuggestedAgentPromptsResponseSchema,
    30_000,
  );
  return response.prompts;
}

/** Stop for a running agent turn. */
export async function cancelAgentTurn(
  request: CancelAgentTurnRequest,
): Promise<CancelAgentTurnResponse> {
  return callSharedFunction(
    'cancelAgentTurn',
    request,
    cancelAgentTurnResponseSchema,
    30_000,
  );
}

/** Out of credits or over a plan limit. Mobile shows a plain message, no purchase path (decision 12). */
export function isLimitError(error: unknown): boolean {
  return (
    isRecordWithMessage(error) && error.code === 'functions/resource-exhausted'
  );
}

export const LIMIT_MESSAGE =
  "You've used this month's credits or hit a plan limit. Your allowance resets with your plan.";

export function getCallableErrorMessage(error: unknown): string {
  if (isLimitError(error)) {
    return LIMIT_MESSAGE;
  }
  if (isRecordWithMessage(error)) {
    if (
      error.code === 'functions/unauthenticated' &&
      error.message === 'Unauthenticated'
    ) {
      return 'App Check verification failed. Register the mobile app in Firebase Console → App Check (debug token for dev builds, Play Integrity / App Attest for release).';
    }
    if (error.message) {
      return error.code ? `${error.message} (${error.code})` : error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
}

// Document narration (ADR 013)

export async function evaluateDocumentNarratability(
  documentId: string,
): Promise<EvaluateDocumentNarratabilityResponse> {
  return callSharedFunction(
    'evaluateDocumentNarratability',
    { documentId },
    evaluateDocumentNarratabilityResponseSchema,
    60_000,
  );
}

export async function quoteDocumentNarration(
  documentId: string,
): Promise<QuoteDocumentNarrationResponse> {
  return callSharedFunction(
    'quoteDocumentNarration',
    { documentId },
    quoteDocumentNarrationResponseSchema,
    60_000,
  );
}

export async function startDocumentNarration(
  request: StartDocumentNarrationRequest,
): Promise<StartDocumentNarrationResponse> {
  return callSharedFunction(
    'startDocumentNarration',
    request,
    startDocumentNarrationResponseSchema,
    60_000,
  );
}

export async function removeDocumentNarration(
  documentId: string,
): Promise<RemoveDocumentNarrationResponse> {
  return callSharedFunction(
    'removeDocumentNarration',
    { documentId },
    removeDocumentNarrationResponseSchema,
    60_000,
  );
}

/** True when the start was refused because the shown price no longer applies. */
export function isNarrationPriceChangedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('details' in error))
    return false;
  const details = error.details;
  return (
    typeof details === 'object' &&
    details !== null &&
    'code' in details &&
    details.code === NARRATION_PRICE_CHANGED_CODE
  );
}
