import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { CreateDocumentRequest, GenerateFromScreenshotRequest } from '@shared-types';
import { functions, waitForAppCheckReady } from '../firebase';
import {
  createDocumentResponseSchema,
  generateFromScreenshotResponseSchema,
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
  timeoutMs?: number
): Promise<TResponse> {
  await waitForAppCheckReady();
  const callable = httpsCallable(functions, functionName, timeoutMs ? { timeout: timeoutMs } : undefined);
  const result = await callable(data);
  return parseCallableResponse(schema, result.data);
}

function isRecordWithMessage(value: unknown): value is { message?: string; code?: string } {
  return typeof value === 'object' && value !== null;
}

export async function getDirectoryTree(): Promise<IGetDirectoryTreeResponse> {
  return callFunction('getDirectoryTree', {}, getDirectoryTreeResponseSchema);
}

export async function createDocument(request: CreateDocumentRequest): Promise<ICreateDocumentResponse> {
  return callFunction('createDocument', request, createDocumentResponseSchema);
}

export async function generateFromScreenshot(
  request: GenerateFromScreenshotRequest
): Promise<IGenerateFromScreenshotResponse> {
  return callFunction('generateFromScreenshot', request, generateFromScreenshotResponseSchema, 540_000);
}

export function getCallableErrorMessage(error: unknown): string {
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
