import type { GoogleGenAI } from '@google/genai';
import type { LlmModality, ProviderCostCallRole } from '@shared-types';
import {
  normalizeGeminiUsageMetadata,
  recordLlmProviderResult,
} from '@study-forge/backend-core/services/provider-cost';

type GeminiGenerateContentRequest = Parameters<
  GoogleGenAI['models']['generateContent']
>[0];

export async function trackedGeminiGenerateContent(
  client: GoogleGenAI,
  request: GeminiGenerateContentRequest,
  tracking: {
    connectionId?: string;
    modality?: LlmModality;
    callRole?: ProviderCostCallRole;
  } = {},
): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
  const startedAt = Date.now();
  const model =
    typeof request.model === 'string' ? request.model : 'gemini-unknown';
  const connectionId = tracking.connectionId ?? 'gemini-platform';

  try {
    const response = await client.models.generateContent(request);
    const finishReason = response.candidates?.[0]?.finishReason;

    await recordLlmProviderResult({
      providerKind: 'gemini',
      connectionId,
      model,
      modality: tracking.modality ?? 'text',
      usage: normalizeGeminiUsageMetadata(response.usageMetadata) ?? undefined,
      status:
        finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED'
          ? 'truncated'
          : 'ok',
      finishReason: finishReason ?? undefined,
      durationMs: Date.now() - startedAt,
      callRole: tracking.callRole ?? 'generation',
    });

    return response;
  } catch (error) {
    await recordLlmProviderResult({
      providerKind: 'gemini',
      connectionId,
      model,
      modality: tracking.modality ?? 'text',
      status: 'error',
      durationMs: Date.now() - startedAt,
      callRole: tracking.callRole ?? 'generation',
    });
    throw error;
  }
}
