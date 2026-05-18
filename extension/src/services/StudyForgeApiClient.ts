import { GenerateFromScreenshotParams, GenerateFromScreenshotResult } from '../types';

interface StudyForgeApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfterSeconds?: number;
}

export class StudyForgeApiClient {
  async generateFromScreenshot({
    apiBaseUrl,
    apiKey,
    directoryId,
    imageBase64,
  }: GenerateFromScreenshotParams): Promise<GenerateFromScreenshotResult> {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/documents/generate-from-screenshot`;
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