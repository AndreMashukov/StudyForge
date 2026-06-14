import type { IMiniMaxProviderConnection } from '@shared-types';
import type { LlmProviderClient } from './llm-provider-client';
import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';

interface MiniMaxChatMessage {
  content?: string;
}

interface MiniMaxChatChoice {
  message?: MiniMaxChatMessage;
}

interface MiniMaxChatResponse {
  choices?: MiniMaxChatChoice[];
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

export class MiniMaxProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly imageGenerationUrl: string,
    private readonly connectionId: string
  ) {}

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const body = JSON.stringify({
      model: request.config.model,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.config.temperature ?? 0.7,
      top_p: request.config.topP,
      max_tokens: request.config.maxOutputTokens ?? 16384,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`MiniMax API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as MiniMaxChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from MiniMax API');

    return {
      text,
      model: request.config.model,
      providerType: 'minimax',
      connectionId: this.connectionId,
    };
  }

  async generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

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
              },
            },
          ],
        },
      ],
      temperature: request.config.temperature ?? 0.7,
      top_p: request.config.topP,
      max_tokens: request.config.maxOutputTokens ?? 16384,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`MiniMax vision API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as MiniMaxChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from MiniMax vision API');

    return {
      text,
      model: request.config.model,
      providerType: 'minimax',
      connectionId: this.connectionId,
    };
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    const body = JSON.stringify({
      model: request.config.model,
      prompt: request.prompt,
      aspect_ratio: request.imageConfig?.aspectRatio ?? '16:9',
      response_format: 'base64',
      n: 1,
    });

    const response = await fetch(this.imageGenerationUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`MiniMax image API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as MiniMaxImageResponse;
    const statusCode = data.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMessage = data.base_resp?.status_msg ?? 'Unknown MiniMax image error';
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
    };
  }
}

export function parseMiniMaxConnection(connection: IMiniMaxProviderConnection | null): {
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
