import { GenerateFromScreenshotParams, GenerateFromScreenshotResult } from '../types';
import { DebugLogService } from './DebugLogService';

interface StudyForgeApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfterSeconds?: number;
}

export class StudyForgeApiClient {
  constructor(private readonly debugLogService?: DebugLogService) {}

  async generateFromScreenshot({
    apiBaseUrl,
    apiKey,
    directoryId,
    imageBase64,
  }: GenerateFromScreenshotParams): Promise<GenerateFromScreenshotResult> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/documents/generate-from-screenshot`;
    await this.debugLogService?.info('Posting screenshot to StudyForge API', {
      url,
      directoryId,
      imageBase64Length: imageBase64.length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey.trim(),
      },
      body: JSON.stringify({
        imageBase64,
        directoryId,
      }),
    });

    const payload = await this.parseResponse(response);
    await this.debugLogService?.info('StudyForge API response received', {
      url,
      status: response.status,
      ok: response.ok,
      success: payload.success,
      error: payload.error,
      retryAfterSeconds: payload.retryAfterSeconds,
    });

    if (!response.ok || !payload.success) {
      const retrySuffix = payload.retryAfterSeconds
        ? ` Try again in ${payload.retryAfterSeconds}s.`
        : '';
      throw new Error(`${payload.error || `StudyForge API returned ${response.status}`}.${retrySuffix}`);
    }

    if (!payload.data?.documentId) {
      throw new Error('StudyForge API did not return a document ID.');
    }

    return payload.data;
  }

  private async parseResponse(response: Response): Promise<StudyForgeApiResponse<GenerateFromScreenshotResult>> {
    const text = await response.text();
    if (!text) {
      return { success: response.ok };
    }

    try {
      return JSON.parse(text) as StudyForgeApiResponse<GenerateFromScreenshotResult>;
    } catch {
      return {
        success: false,
        error: text,
      };
    }
  }
}