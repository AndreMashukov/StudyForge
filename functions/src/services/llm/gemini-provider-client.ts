import { GoogleGenAI } from '@google/genai';
import type { LlmProviderClient } from './llm-provider-client';
import type {
  LlmImageRequest,
  LlmImageResult,
  LlmTextRequest,
  LlmTextResult,
  LlmVisionRequest,
  LlmVisionResult,
} from './types';

export class GeminiProviderClient implements LlmProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly connectionId: string
  ) {}

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const client = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await client.models.generateContent({
      model: request.config.model,
      contents: request.prompt,
      config: {
        temperature: request.config.temperature,
        topK: request.config.topK,
        topP: request.config.topP,
        maxOutputTokens: request.config.maxOutputTokens,
        ...(request.config.responseMimeType
          ? { responseMimeType: request.config.responseMimeType }
          : {}),
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return {
      text,
      model: request.config.model,
      providerType: 'gemini',
      connectionId: this.connectionId,
    };
  }

  async generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult> {
    void request;
    throw new Error(
      'Gemini vision is handled by GeminiService.generateDocumentFromScreenshot'
    );
  }

  async generateImage(request: LlmImageRequest): Promise<LlmImageResult> {
    void request;
    throw new Error('Gemini image generation is handled by GeminiService slide image methods');
  }
}
