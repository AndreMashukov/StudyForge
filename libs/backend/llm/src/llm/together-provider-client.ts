import * as functions from 'firebase-functions';
import { DEFAULT_LLM_GENERATION_SETTINGS } from '@shared-types';
import { buildImageMegapixelUsage } from '@study-forge/backend-core/services/provider-cost';
import type { LlmProviderClient } from './llm-provider-client';
import {
  consumeTogetherChatCompletionStream,
  type ITogetherStreamedChatResult,
} from './together-chat-stream';
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
 * completions is 120–180s. Thinking models often need 32k max_tokens so reasoning
 * does not consume the entire completion budget.
 */
const TOGETHER_REQUEST_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTogetherImageBase64(payload: unknown): string | null {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.data) ||
    payload.data.length === 0
  ) {
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

function throwEmptyTogetherChatResponse(
  diagnostics: Pick<
    ITogetherStreamedChatResult,
    'finishReason' | 'hasReasoning' | 'reasoningLength'
  >,
  label: string,
  maxOutputTokens?: number,
): never {
  functions.logger.warn(`Empty Together ${label} response`, {
    ...diagnostics,
    maxOutputTokens,
  });

  if (diagnostics.finishReason === 'length' && diagnostics.hasReasoning) {
    throw new Error(
      `Malformed or empty response from Together ${label}: output truncated after reasoning ` +
        `(finish_reason=length, reasoningLength=${diagnostics.reasoningLength}` +
        `${maxOutputTokens !== undefined ? `, maxOutputTokens=${maxOutputTokens}` : ''}). ` +
        'Increase maxOutputTokens for thinking models.',
    );
  }

  throw new Error(`Malformed or empty response from Together ${label}`);
}

async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  consumeResponse: (response: Response) => Promise<T>,
  timeoutMs: number = TOGETHER_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return await consumeResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Together request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  errorLabel: string,
  timeoutMs?: number,
): Promise<unknown> {
  return fetchWithTimeout<unknown>(
    url,
    init,
    async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '(unreadable)');
        throw new Error(`${errorLabel} ${response.status}: ${errorText}`);
      }

      return response.json();
    },
    timeoutMs,
  );
}

async function fetchTogetherChatCompletionStream(
  url: string,
  init: RequestInit,
  errorLabel: string,
  timeoutMs?: number,
): Promise<ITogetherStreamedChatResult> {
  return fetchWithTimeout(
    url,
    init,
    async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '(unreadable)');
        throw new Error(`${errorLabel} ${response.status}: ${errorText}`);
      }

      return consumeTogetherChatCompletionStream(response);
    },
    timeoutMs,
  );
}

function resolveTogetherImageDimensions(aspectRatio?: string): {
  width: number;
  height: number;
} {
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

function buildTogetherChatBody(input: {
  model: string;
  messages: unknown[];
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  disableReasoning?: boolean;
}): string {
  return JSON.stringify({
    model: input.model,
    messages: input.messages,
    // Some Together models (e.g. Qwen3.7-Plus) reject non-streaming requests.
    // Artifact generation still buffers the full text before parse/persist.
    stream: true,
    temperature:
      input.temperature ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
    top_p: input.topP,
    max_tokens: input.maxOutputTokens ?? 16384,
    ...(input.disableReasoning ? { reasoning: { enabled: false } } : {}),
  });
}

export class TogetherProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly connectionId: string,
  ) {}

  private get chatCompletionsUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  private get imageGenerationsUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/images/generations`;
  }

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const startedAt = Date.now();
    const body = buildTogetherChatBody({
      model: request.config.model,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.config.temperature,
      topP: request.config.topP,
      maxOutputTokens: request.config.maxOutputTokens,
      disableReasoning: request.config.disableReasoning,
    });

    const streamed = await fetchTogetherChatCompletionStream(
      this.chatCompletionsUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body,
      },
      'Together API error',
      request.config.requestTimeoutMs,
    );

    if (!streamed.text) {
      throwEmptyTogetherChatResponse(
        streamed,
        'API',
        request.config.maxOutputTokens,
      );
    }

    return {
      text: streamed.text,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
      usage: streamed.usage,
      finishReason: streamed.finishReason ?? undefined,
      durationMs: Date.now() - startedAt,
    };
  }

  async generateVisionText(
    request: LlmVisionRequest,
  ): Promise<LlmVisionResult> {
    const startedAt = Date.now();
    const detail = request.detail ?? 'auto';

    const body = buildTogetherChatBody({
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
      temperature: request.config.temperature,
      topP: request.config.topP,
      maxOutputTokens: request.config.maxOutputTokens,
      disableReasoning: request.config.disableReasoning,
    });

    const streamed = await fetchTogetherChatCompletionStream(
      this.chatCompletionsUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body,
      },
      'Together vision API error',
      request.config.requestTimeoutMs,
    );

    if (!streamed.text) {
      throwEmptyTogetherChatResponse(
        streamed,
        'vision API',
        request.config.maxOutputTokens,
      );
    }

    return {
      text: streamed.text,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
      usage: streamed.usage,
      finishReason: streamed.finishReason ?? undefined,
      durationMs: Date.now() - startedAt,
    };
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    const startedAt = Date.now();
    const { width, height } = resolveTogetherImageDimensions(
      request.imageConfig?.aspectRatio,
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

    const payload = await fetchJsonWithTimeout(
      this.imageGenerationsUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      },
      'Together image API error',
      request.config.requestTimeoutMs,
    );

    const imageBase64 = parseTogetherImageBase64(payload);
    if (!imageBase64) {
      throw new Error('Malformed or empty image response from Together API');
    }

    return {
      imageBase64,
      model: request.config.model,
      providerType: 'together',
      connectionId: this.connectionId,
      usage: buildImageMegapixelUsage({ width, height, steps: 4 }),
      durationMs: Date.now() - startedAt,
    };
  }
}
