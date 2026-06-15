import { httpsCallable } from 'firebase/functions';
import {
  CreateDocumentRequest,
  DocumentEnhanced,
  GenerateFromScreenshotRequest,
  GenerateFromScreenshotResponse,
  GetDirectoryTreeResponse,
} from '@shared-types';
import { functions } from '../firebase';

async function callFunction<TRequest, TResponse>(
  functionName: string,
  data: TRequest,
  timeoutMs?: number
): Promise<TResponse> {
  const callable = httpsCallable(functions, functionName, timeoutMs ? { timeout: timeoutMs } : undefined);
  const result = await callable(data);
  return result.data as TResponse;
}

export async function getDirectoryTree(): Promise<GetDirectoryTreeResponse> {
  return callFunction<Record<string, never>, GetDirectoryTreeResponse>('getDirectoryTree', {});
}

export async function createDocument(
  request: CreateDocumentRequest
): Promise<{ success: boolean; document: DocumentEnhanced }> {
  return callFunction<CreateDocumentRequest, { success: boolean; document: DocumentEnhanced }>(
    'createDocument',
    request
  );
}

export async function generateFromScreenshot(
  request: GenerateFromScreenshotRequest
): Promise<GenerateFromScreenshotResponse & { success: boolean }> {
  return callFunction<GenerateFromScreenshotRequest, GenerateFromScreenshotResponse & { success: boolean }>(
    'generateFromScreenshot',
    request,
    540_000
  );
}

export function getCallableErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const record = error as { message?: string; code?: string; details?: unknown };
    if (record.message) {
      return record.code ? `${record.message} (${record.code})` : record.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
}
