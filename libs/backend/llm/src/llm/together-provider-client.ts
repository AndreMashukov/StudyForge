import * as functions from 'firebase-functions';
import type { LlmProviderClient } from './llm-provider-client';
import {
  parseTogetherChatContent,
  summarizeTogetherChatPayload,
} from './together-chat-content';
import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';

/**
 * Together TS SDK default is 60s; production guidance for larger models / long
 * completions is 120–180s. StudyForge allows up to 16384 max_tokens for text/vision.
 */
const TOGETHER_REQUEST_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTogetherImageBase64(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.data) || payload.data.length === 0) {
    return null;
  }

  const entry = payload.data[0];
  if (!isRecord(entry)) {
    return null;
  }

  const imageBase64 = entry.b64_json;
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return null;
  }

  return imageBase64;
}

function throwEmptyTogetherChatResponse(payload: unknown, label: string): never {
  const diagnostics = summarizeTogetherChatPayload(payload);
  functions.logger.warn(`Empty Together ${label} response`, diagnostics);

  if (diagnostics.finishReason === 'length' && diagnostics.hasReasoning) {
    throw new Error(
      `Malformed or empty response from Together ${label}: output truncated after reasoning ` +
        `(finish_reason=length, reasoningLength=${diagnostics.reasoningLength}). ` +
        'Increase maxOutputTokens for thinking models.'
    );
  }

  throw new Error(`Malformed or empty response from Together ${label}`);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = TOGETHER_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Together request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveTogetherImageDimensions(
  aspectRatio?: string
): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9':
      return { width: 1024, height: 576 };
    case '9:16':
      return { width: 576, height: 1024 };
    case '4:3':
      return { width: 1024, height: 768 };
    case '3:4':
      return { width: 768, height: 1024 };
    case '1:1':
    default:
      return { width: 1024, height: 1024 };
  }
}

export class TogetherProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly connectionId: string
  ) {}

  private get chatCompletionsUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  private get imageGenerationsUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/images/generations`;
  }

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const body = JSON.stringify({
      model: request.config.model,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.config.temperature ?? 0.7,
      top_p: request.config.topP,
      max_tokens: request.config.maxOutputTokens ?? 16384,
      ...(request.config.disableReasoning
        ? { reasoning: { enabled: false } }
        : {}),
    });

    const response = await fetchWithTimeout(this.chatCompletionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`Together API error ${response.status}: ${errorText}`);
    }

    const payload: unknown = await response.json();
    const text = parseTogetherChatContent(payload);
    if (!text) {
      throwEmptyTogetherChatResponse(payload, 'API');
    }

    return {
      text,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
    };
  }

  async generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult> {
    const detail = request.detail ?? 'auto';

    const body = JSON.stringify({
      model: request.config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            {
              type: 'image_url',
              image_url: {
                url: request.imageDataUrl,
                detail,
              },
            },
          ],
        },
      ],
      temperature: request.config.temperature ?? 0.7,
      top_p: request.config.topP,
      max_tokens: request.config.maxOutputTokens ?? 16384,
    });

    const response = await fetchWithTimeout(this.chatCompletionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`Together vision API error ${response.status}: ${errorText}`);
    }

    const payload: unknown = await response.json();
    const text = parseTogetherChatContent(payload);
    if (!text) {
      throwEmptyTogetherChatResponse(payload, 'vision API');
    }

    return {
      text,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
    };
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    const { width, height } = resolveTogetherImageDimensions(
      request.imageConfig?.aspectRatio
    );

    const body = JSON.stringify({
      model: request.config.model,
      prompt: request.prompt,
      width,
      height,
      steps: 4,
      n: 1,
      response_format: 'base64',
    });

    const response = await fetchWithTimeout(this.imageGenerationsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`Together image API error ${response.status}: ${errorText}`);
    }

    const payload: unknown = await response.json();
    const imageBase64 = parseTogetherImageBase64(payload);
    if (!imageBase64) {
      throw new Error('Malformed or empty image response from Together API');
    }

    return {
      imageBase64,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
    };
  }
}
