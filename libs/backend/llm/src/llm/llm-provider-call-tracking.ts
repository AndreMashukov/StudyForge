import { recordLlmProviderResult } from '@study-forge/backend-core/services/provider-cost';
import type { LlmModality, ProviderCostCallRole } from '@shared-types';
import type { LlmImageResult, LlmTextResult, LlmVisionResult } from './types';

function mapFinishReasonToStatus(
  finishReason?: string,
): 'ok' | 'truncated' {
  if (finishReason === 'length') {
    return 'truncated';
  }
  return 'ok';
}

export async function trackLlmProviderTextResult(
  result: LlmTextResult,
  params: {
    modality?: LlmModality;
    callRole?: ProviderCostCallRole;
    startedAt: number;
  },
): Promise<void> {
  await recordLlmProviderResult({
    providerKind: result.providerType,
    connectionId: result.connectionId,
    model: result.model,
    modality: params.modality ?? 'text',
    usage: result.usage,
    status: mapFinishReasonToStatus(result.finishReason),
    finishReason: result.finishReason,
    durationMs: result.durationMs ?? Date.now() - params.startedAt,
    callRole: params.callRole ?? 'generation',
  });
}

export async function trackLlmProviderVisionResult(
  result: LlmVisionResult,
  params: {
    callRole?: ProviderCostCallRole;
    startedAt: number;
  },
): Promise<void> {
  await recordLlmProviderResult({
    providerKind: result.providerType,
    connectionId: result.connectionId,
    model: result.model,
    modality: 'vision',
    usage: result.usage,
    status: mapFinishReasonToStatus(result.finishReason),
    finishReason: result.finishReason,
    durationMs: result.durationMs ?? Date.now() - params.startedAt,
    callRole: params.callRole ?? 'generation',
  });
}

export async function trackLlmProviderImageResult(
  result: LlmImageResult,
  params: {
    callRole?: ProviderCostCallRole;
    startedAt: number;
  },
): Promise<void> {
  await recordLlmProviderResult({
    providerKind: result.providerType,
    connectionId: result.connectionId,
    model: result.model,
    modality: 'image',
    usage: result.usage,
    status: 'ok',
    durationMs: result.durationMs ?? Date.now() - params.startedAt,
    callRole: params.callRole ?? 'image',
  });
}

export async function trackLlmProviderError(params: {
  providerKind: LlmTextResult['providerType'];
  connectionId: string;
  model: string;
  modality: LlmModality;
  callRole?: ProviderCostCallRole;
  startedAt: number;
}): Promise<void> {
  await recordLlmProviderResult({
    providerKind: params.providerKind,
    connectionId: params.connectionId,
    model: params.model,
    modality: params.modality,
    usage: undefined,
    status: 'error',
    durationMs: Date.now() - params.startedAt,
    callRole: params.callRole ?? 'generation',
  });
}
