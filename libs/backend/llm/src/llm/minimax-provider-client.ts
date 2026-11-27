import * as functions from 'firebase-functions';
import type {
  IMiniMaxProviderConnection,
  IProviderUsageUnits,
} from '@shared-types';
import { DEFAULT_LLM_GENERATION_SETTINGS } from '@shared-types';
import { normalizeOpenAiCompatibleUsage } from '@study-forge/backend-core/services/provider-cost';
import type { LlmProviderClient } from './llm-provider-client';
import { fitMiniMaxImagePrompt } from './llm-image-prompt-utils';
import { stripRedactedThinking } from './llm-response-text-utils';
import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';

interface MiniMaxChatMessage {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: unknown[] | null;
}

interface MiniMaxChatChoice {
  message?: MiniMaxChatMessage;
  finish_reason?: string | null;
}

interface MiniMaxChatResponse {
  choices?: MiniMaxChatChoice[];
  usage?: unknown;
}

interface MiniMaxImageData {
  image_base64?: string[];
}

interface MiniMaxImageResponse {
  data?: MiniMaxImageData;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Thrown when MiniMax answers 200 OK without usable answer text — most often
 * a reasoning-enabled call whose thinking used the whole `max_tokens` budget
 * (`finish_reason: "length"`, only `reasoning_content` returned).
 */
export class MiniMaxEmptyResponseError extends Error {
  constructor(
    readonly api: 'text' | 'vision',
    readonly details: IMiniMaxEmptyResponseDetails,
  ) {
    super(formatEmptyResponseMessage(api, details));
    this.name = 'MiniMaxEmptyResponseError';
  }
}

export interface IMiniMaxEmptyResponseDetails {
  finishReason?: string;
  reasoningEnabled: boolean;
  /** Content was present but held only thinking wrappers. */
  strippedThinkingOnly: boolean;
  reasoningTokens?: number;
  outputTokens?: number;
  maxOutputTokens: number;
  /** True when this is the reasoning-disabled retry that also came back empty. */
  afterReasoningFallback: boolean;
}

function formatEmptyResponseMessage(
  api: 'text' | 'vision',
  details: IMiniMaxEmptyResponseDetails,
): string {
  const base =
    api === 'vision'
      ? 'Empty response from MiniMax vision API'
      : 'Empty response from MiniMax API';
  const parts = [
    `finish_reason=${details.finishReason ?? 'unknown'}`,
    details.reasoningTokens !== undefined
      ? `reasoning_tokens=${details.reasoningTokens}`
      : undefined,
    details.outputTokens !== undefined
      ? `completion_tokens=${details.outputTokens}`
      : undefined,
    `max_tokens=${details.maxOutputTokens}`,
    details.strippedThinkingOnly ? 'content was thinking only' : undefined,
    details.afterReasoningFallback
      ? 'also empty with reasoning disabled'
      : undefined,
  ].filter(Boolean);
  return `${base} (${parts.join(', ')})`;
}

type MiniMaxChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface IMiniMaxCompletionOutcome {
  text: string;
  usage: IProviderUsageUnits | undefined;
  finishReason?: string;
  emptyDetails?: IMiniMaxEmptyResponseDetails;
}

function sumUsage(
  a: IProviderUsageUnits | undefined,
  b: IProviderUsageUnits | undefined,
): IProviderUsageUnits | undefined {
  if (!a) return b;
  if (!b) return a;
  const add = (x?: number, y?: number) =>
    x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0);
  const summed: IProviderUsageUnits = {
    inputTokens: add(a.inputTokens, b.inputTokens),
    outputTokens: add(a.outputTokens, b.outputTokens),
    cachedInputTokens: add(a.cachedInputTokens, b.cachedInputTokens),
    reasoningTokens: add(a.reasoningTokens, b.reasoningTokens),
    totalTokens: add(a.totalTokens, b.totalTokens),
  };
  return Object.fromEntries(
    Object.entries(summed).filter(([, value]) => value !== undefined),
  );
}

export class MiniMaxProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly imageGenerationUrl: string,
    private readonly connectionId: string,
  ) {}

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const startedAt = Date.now();
    const outcome = await this.completeChat(
      'text',
      request.config,
      request.prompt,
    );
    return {
      text: outcome.text,
      model: request.config.model,
      providerType: 'minimax',
      connectionId: this.connectionId,
      usage: outcome.usage,
      finishReason: outcome.finishReason,
      durationMs: Date.now() - startedAt,
    };
  }

  async generateVisionText(
    request: LlmVisionRequest,
  ): Promise<LlmVisionResult> {
    const startedAt = Date.now();
    const outcome = await this.completeChat('vision', request.config, [
      { type: 'text', text: request.prompt },
      { type: 'image_url', image_url: { url: request.imageDataUrl } },
    ]);
    return {
      text: outcome.text,
      model: request.config.model,
      providerType: 'minimax',
      connectionId: this.connectionId,
      usage: outcome.usage,
      finishReason: outcome.finishReason,
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Runs a chat completion. When reasoning is enabled and MiniMax returns no
   * answer text (thinking consumed the output budget, so only
   * `reasoning_content` came back), retries once with reasoning disabled so the
   * whole budget goes to the answer.
   */
  private async completeChat(
    api: 'text' | 'vision',
    config: LlmTextRequest['config'],
    content: MiniMaxChatContent,
  ): Promise<IMiniMaxCompletionOutcome> {
    const reasoningEnabled = !config.disableReasoning;
    const first = await this.postChatCompletion(
      api,
      config,
      content,
      !reasoningEnabled,
      false,
    );
    if (!first.emptyDetails) {
      return first;
    }
    if (!reasoningEnabled) {
      throw new MiniMaxEmptyResponseError(api, first.emptyDetails);
    }

    functions.logger.warn(
      'MiniMax returned no answer text with reasoning enabled; retrying with reasoning disabled',
      { model: config.model, api, ...first.emptyDetails },
    );

    const retry = await this.postChatCompletion(
      api,
      config,
      content,
      true,
      true,
    );
    if (retry.emptyDetails) {
      throw new MiniMaxEmptyResponseError(api, retry.emptyDetails);
    }
    return { ...retry, usage: sumUsage(first.usage, retry.usage) };
  }

  private async postChatCompletion(
    api: 'text' | 'vision',
    config: LlmTextRequest['config'],
    content: MiniMaxChatContent,
    disableReasoning: boolean,
    isReasoningFallback: boolean,
  ): Promise<IMiniMaxCompletionOutcome> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const maxOutputTokens = config.maxOutputTokens ?? 16384;

    const body = JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content }],
      temperature:
        config.temperature ?? DEFAULT_LLM_GENERATION_SETTINGS.temperature,
      top_p: config.topP,
      max_tokens: maxOutputTokens,
      reasoning_split: true,
      ...(disableReasoning ? { thinking: { type: 'disabled' } } : {}),
    });

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(
        config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      ),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      const label = api === 'vision' ? 'MiniMax vision API' : 'MiniMax API';
      throw new Error(`${label} error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as MiniMaxChatResponse;
    const choice = data.choices?.[0];
    const rawText =
      typeof choice?.message?.content === 'string'
        ? choice.message.content
        : '';
    const text = rawText ? stripRedactedThinking(rawText) : '';
    const usage = normalizeOpenAiCompatibleUsage(data.usage) ?? undefined;
    const finishReason = choice?.finish_reason ?? undefined;

    if (text) {
      return { text, usage, finishReason };
    }

    return {
      text: '',
      usage,
      finishReason,
      emptyDetails: {
        finishReason,
        reasoningEnabled: !disableReasoning,
        strippedThinkingOnly: rawText.trim().length > 0,
        reasoningTokens: usage?.reasoningTokens,
        outputTokens: usage?.outputTokens,
        maxOutputTokens,
        afterReasoningFallback: isReasoningFallback,
      },
    };
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    const startedAt = Date.now();
    const prompt = fitMiniMaxImagePrompt(request.prompt);

    const body = JSON.stringify({
      model: request.config.model,
      prompt,
      aspect_ratio: request.imageConfig?.aspectRatio ?? '16:9',
      response_format: 'base64',
      n: 1,
    });

    const response = await fetch(this.imageGenerationUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(
        request.config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      ),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `MiniMax image API error ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as MiniMaxImageResponse;
    const statusCode = data.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMessage =
        data.base_resp?.status_msg ?? 'Unknown MiniMax image error';
      throw new Error(`MiniMax image API error: ${statusMessage}`);
    }

    const imageBase64 = data.data?.image_base64?.[0];
    if (!imageBase64) {
      throw new Error('Empty image response from MiniMax API');
    }

    return {
      imageBase64,
      model: request.config.model,
      providerType: 'minimax',
      connectionId: this.connectionId,
      durationMs: Date.now() - startedAt,
    };
  }
}

export function parseMiniMaxConnection(
  connection: IMiniMaxProviderConnection | null,
): {
  baseUrl: string;
  imageGenerationUrl: string;
  defaultModel: string;
  defaultVisionModel: string;
  defaultImageModel: string;
} {
  return {
    baseUrl: connection?.baseUrl?.trim() || 'https://api.minimax.io/v1',
    imageGenerationUrl:
      connection?.imageGenerationUrl?.trim() ||
      'https://api.minimax.io/v1/image_generation',
    defaultModel: connection?.defaultModel?.trim() || 'MiniMax-M3',
    defaultVisionModel:
      connection?.defaultVisionModel?.trim() ||
      connection?.defaultModel?.trim() ||
      'MiniMax-M3',
    defaultImageModel: connection?.defaultImageModel?.trim() || 'image-01',
  };
}
