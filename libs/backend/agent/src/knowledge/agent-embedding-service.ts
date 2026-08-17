import * as functions from 'firebase-functions';
import { LlmGenerationRouteResolver } from '@study-forge/backend-llm/llm';
import { LlmProviderClientFactory } from '@study-forge/backend-llm/llm/llm-provider-client-factory';
import { decryptLlmSecret, isLlmEncryptionAvailable } from '@study-forge/backend-llm/llm/llm-secret-resolver';
import { ProviderConnectionRepository } from '@study-forge/backend-llm/llm/provider-connection-repository';
import {
  buildEmbeddingBatchUsage,
  normalizeOpenAiCompatibleUsage,
  recordLlmProviderResult,
} from '@study-forge/backend-core/services/provider-cost';
import type { IProviderUsageUnits } from '@shared-types';
import type { ResolvedRoute } from '@study-forge/backend-llm/llm/types';

const TOGETHER_EMBEDDINGS_PATH = '/embeddings';
const OPENROUTER_EMBEDDINGS_PATH = '/embeddings';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function recordEmbeddingProviderCall(params: {
  route: ResolvedRoute;
  usage?: IProviderUsageUnits;
  startedAt: number;
  status?: 'ok' | 'error';
}): Promise<void> {
  await recordLlmProviderResult({
    providerKind: params.route.providerType,
    connectionId: params.route.connectionId,
    model: params.route.model,
    modality: 'embedding',
    usage: params.usage,
    status: params.status ?? 'ok',
    durationMs: Date.now() - params.startedAt,
    callRole: 'embed',
  });
}

async function fetchEmbeddings(
  url: string,
  apiKey: string,
  model: string,
  inputs: string[],
  route: ResolvedRoute,
  headers: Record<string, string> = {},
): Promise<number[][]> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ model, input: inputs }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(unreadable)');
      throw new Error(`Embedding API error ${response.status}: ${errorText}`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error('Malformed embedding batch response');
    }

    const usageFromPayload = normalizeOpenAiCompatibleUsage(payload.usage);
    const fallbackUsage = buildEmbeddingBatchUsage(
      inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
    );

    await recordEmbeddingProviderCall({
      route,
      usage: usageFromPayload ?? fallbackUsage,
      startedAt,
    });

    return payload.data.map((entry) => {
      if (!isRecord(entry) || !Array.isArray(entry.embedding)) {
        throw new Error('Malformed embedding vector in batch response');
      }
      return entry.embedding.filter((value): value is number => typeof value === 'number');
    });
  } catch (error) {
    await recordEmbeddingProviderCall({
      route,
      usage: undefined,
      startedAt,
      status: 'error',
    });
    throw error;
  }
}

async function embedWithGemini(
  apiKey: string,
  model: string,
  inputs: string[],
  route: ResolvedRoute,
): Promise<number[][]> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey });

  const vectors: number[][] = [];
  for (const input of inputs) {
    const startedAt = Date.now();
    try {
      const response = await client.models.embedContent({
        model,
        contents: input,
      });

      const values = response.embeddings?.[0]?.values;
      if (!values || values.length === 0) {
        throw new Error('Empty Gemini embedding response');
      }

      await recordEmbeddingProviderCall({
        route,
        usage: buildEmbeddingBatchUsage(Math.ceil(input.length / 4)),
        startedAt,
      });

      vectors.push(values);
    } catch (error) {
      await recordEmbeddingProviderCall({
        route,
        usage: undefined,
        startedAt,
        status: 'error',
      });
      throw error;
    }
  }

  return vectors;
}

export class AgentEmbeddingService {
  static async embedTexts(userId: string, inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) {
      return [];
    }

    const resolution = await LlmGenerationRouteResolver.resolve('agentKnowledgeEmbedding', {
      userId,
    });

    functions.logger.info('Agent embedding route resolved', {
      userId,
      providerType: resolution.route.providerType,
      model: resolution.route.model,
    });

    if (resolution.route.providerType === 'gemini') {
      const connection = await ProviderConnectionRepository.getById(resolution.route.connectionId);
      if (!connection || !isLlmEncryptionAvailable()) {
        throw new Error('Gemini provider connection is not configured for embeddings');
      }
      const secret = await ProviderConnectionRepository.getEncryptedSecret(
        resolution.route.connectionId
      );
      if (!secret) {
        throw new Error('Gemini embedding credentials are missing');
      }
      const apiKey = decryptLlmSecret(secret);
      return embedWithGemini(apiKey, resolution.route.model, inputs, resolution.route);
    }

    const client = LlmProviderClientFactory.create(
      resolution.route,
      resolution.providerApiKey
    );

    if (resolution.route.providerType === 'together') {
      const baseUrl = resolution.route.togetherBaseUrl ?? 'https://api.together.xyz/v1';
      const url = `${baseUrl.replace(/\/$/, '')}${TOGETHER_EMBEDDINGS_PATH}`;
      if (!resolution.providerApiKey) {
        throw new Error('Together embedding credentials are missing');
      }
      return fetchEmbeddings(
        url,
        resolution.providerApiKey,
        resolution.route.model,
        inputs,
        resolution.route,
      );
    }

    if (resolution.route.providerType === 'openrouter') {
      const baseUrl = resolution.route.openRouterBaseUrl ?? 'https://openrouter.ai/api/v1';
      const url = `${baseUrl.replace(/\/$/, '')}${OPENROUTER_EMBEDDINGS_PATH}`;
      if (!resolution.providerApiKey) {
        throw new Error('OpenRouter embedding credentials are missing');
      }
      return fetchEmbeddings(
        url,
        resolution.providerApiKey,
        resolution.route.model,
        inputs,
        resolution.route,
        {
          'HTTP-Referer': 'https://study-forge.app',
          'X-Title': 'StudyForge',
        },
      );
    }

    void client;
    throw new Error(
      `Embedding provider ${resolution.route.providerType} is not supported for agentKnowledgeEmbedding`
    );
  }

  static async embedText(userId: string, input: string): Promise<number[]> {
    const [vector] = await AgentEmbeddingService.embedTexts(userId, [input]);
    if (!vector) {
      throw new Error('Embedding service returned no vector');
    }
    return vector;
  }
}
