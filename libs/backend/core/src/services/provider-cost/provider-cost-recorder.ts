import type {
  IProviderUsageUnits,
  LlmModality,
  LlmProviderKind,
  ProviderCostCallRole,
  ProviderCostCallStatus,
} from '@shared-types';
import { recordProviderCallSafe } from './provider-cost-ledger-service';

export async function recordLlmProviderResult(params: {
  providerKind: LlmProviderKind;
  connectionId: string;
  model: string;
  modality: LlmModality;
  usage?: IProviderUsageUnits | null;
  status?: ProviderCostCallStatus;
  finishReason?: string;
  durationMs?: number;
  callRole?: ProviderCostCallRole;
  attempt?: number;
}): Promise<void> {
  await recordProviderCallSafe({
    providerKind: params.providerKind,
    connectionId: params.connectionId,
    model: params.model,
    modality: params.modality,
    usage: params.usage ?? undefined,
    status: params.status ?? 'ok',
    finishReason: params.finishReason,
    durationMs: params.durationMs,
    callRole: params.callRole,
    attempt: params.attempt,
  });
}
