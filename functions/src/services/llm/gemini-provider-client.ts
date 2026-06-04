import { GoogleGenAI } from '@google/genai';
import type { LlmProviderClient } from './llm-provider-client';
import type { LlmTextRequest, LlmTextResult, LlmVisionRequest, LlmVisionResult } from './types';

export class GeminiProviderClient implements LlmProviderClient {
  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: request.config.model,
      contents: request.prompt,
      config: {
        temperature: request.config.temperature,
        topK: request.config.topK,
        topP: request.config.topP,
        maxOutputTokens: request.config.maxOutputTokens,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini API');

    return {
      text,
      model: request.config.model,
      providerType: 'gemini',
      connectionId: 'gemini-primary',
    };
  }

  async generateVisionText(request: LlmVisionRequest): Promise<LlmVisionResult> {
    void request;
    throw new Error(
      'Gemini vision is handled by GeminiService.generateDocumentFromScreenshot'
    );
  }
}
