import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import type {
  CreateDocumentFromPastedTextRequest,
  CreateDocumentFromUrlRequest,
  CreateDocumentRequest,
  EvaluateScratchPadAnswerRequest,
  GenerateFlashcardsRequest,
  GenerateFromScreenshotRequest,
  GenerateQuizRequest,
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
