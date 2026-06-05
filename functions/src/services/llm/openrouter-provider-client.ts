import type { LlmProviderClient } from './llm-provider-client';
import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';
import { extractBase64FromImageDataUrl } from './llm-image-utils';

interface OpenRouterImagePart {
  image_url?: { url?: string };
}

interface OpenRouterChatMessage {
  content?: string;
  images?: OpenRouterImagePart[];
}

interface OpenRouterChatChoice {
  message?: OpenRouterChatMessage;
}

interface OpenRouterChatResponse {
  choices?: OpenRouterChatChoice[];
}

export class OpenRouterProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
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
        'HTTP-Referer': 'https://study-forge.app',
        'X-Title': 'StudyForge',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter API');

    return {
      text,
      model: request.config.model,
      providerType: 'openrouter',
      connectionId: this.connectionId,
    };
  }

  async generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://study-forge.app',
        'X-Title': 'StudyForge',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenRouter vision API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenRouter vision API');

    return {
      text,
      model: request.config.model,
      providerType: 'openrouter',
      connectionId: this.connectionId,
    };
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const imageConfig =
      request.imageConfig?.aspectRatio || request.imageConfig?.imageSize
        ? {
            ...(request.imageConfig.aspectRatio
              ? { aspect_ratio: request.imageConfig.aspectRatio }
              : {}),
            ...(request.imageConfig.imageSize
              ? { image_size: request.imageConfig.imageSize }
              : {}),
          }
        : undefined;

    const body = JSON.stringify({
      model: request.config.model,
      messages: [{ role: 'user', content: request.prompt }],
      modalities: ['image', 'text'],
      ...(imageConfig ? { image_config: imageConfig } : {}),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://study-forge.app',
        'X-Title': 'StudyForge',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenRouter image API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const message = data.choices?.[0]?.message;
    const imageUrl = message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      throw new Error('Empty image response from OpenRouter API');
    }

    const imageBase64 = extractBase64FromImageDataUrl(imageUrl);
    if (!imageBase64) {
      throw new Error('OpenRouter image response did not contain valid base64 data');
    }

    return {
      imageBase64,
      model: request.config.model,
      providerType: 'openrouter',
      connectionId: this.connectionId,
    };
  }
}
