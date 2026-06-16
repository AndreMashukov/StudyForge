import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { CreateDocumentRequest, GenerateFromScreenshotRequest } from '@shared-types';
import { functions } from '../firebase';
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
  if (isRecordWithMessage(error) && error.message) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
}
