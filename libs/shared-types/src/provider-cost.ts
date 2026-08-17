import type {
  GenerationKind,
  GenerationWorkflow,
  LlmModality,
} from './generation-kind-metadata';

export type LlmProviderKind = 'gemini' | 'openrouter' | 'minimax' | 'together';

export type ProviderCostCallRole =
  | 'generation'
  | 'repair'
  | 'agent_step'
  | 'embed'
  | 'image';

export type ProviderCostCallStatus = 'ok' | 'error' | 'timeout' | 'truncated';

export type ProviderCostSource = 'provider_usage_estimate' | 'unknown';

export type ProviderCostMeter = 'token' | 'image_megapixel' | 'embedding_token';

/** Normalized usage units from a provider response. */
export interface IProviderUsageUnits {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  megapixels?: number;
  steps?: number;
}

/** Rate snapshot stored on each ledger row (USD). */
export interface IProviderRateSnapshot {
  meter: ProviderCostMeter;
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  cachedInputUsdPer1M?: number;
  imageUsdPerMegapixel?: number;
  defaultSteps?: number;
  rateCatalogDocId?: string;
  source: 'firestore_catalog' | 'fallback_catalog';
}

/** One provider HTTP/SDK call. */
export interface ILlmUsageEvent {
  id: string;
  userId: string;
  periodKey: string;
  generationKind?: GenerationKind;
  reservationId?: string;
  jobId?: string;
  recordId?: string;
  threadId?: string;
  llmSetupId?: string;
  userGroupId?: string;
  providerKind: LlmProviderKind;
  connectionId: string;
  model: string;
  modality: LlmModality;
  workflow?: GenerationWorkflow;
  callRole: ProviderCostCallRole;
  callSequence: number;
  usage: IProviderUsageUnits;
  rateSnapshot?: IProviderRateSnapshot;
  costUsd?: number;
  costKnown: boolean;
  costSource: ProviderCostSource;
  status: ProviderCostCallStatus;
  finishReason?: string;
  attempt: number;
  durationMs?: number;
  createdAt: string;
}

/** Per-user monthly rollup at users/{uid}/providerCostPeriods/{YYYY-MM}. */
export interface IUserProviderCostPeriod {
  periodKey: string;
  userId: string;
  knownCostUsd: number;
  unknownCostEventCount: number;
  totalEventCount: number;
  committedCredits: number;
  costUsdPerCommittedCredit?: number;
  byProvider: Record<string, IProviderCostBucket>;
  byModel: Record<string, IProviderCostBucket>;
  byGenerationKind: Record<string, IProviderCostBucket>;
  updatedAt: string;
}

/** Admin-wide monthly rollup at providerCostPeriods/{YYYY-MM}. */
export interface IAdminProviderCostPeriod {
  periodKey: string;
  knownCostUsd: number;
  unknownCostEventCount: number;
  totalEventCount: number;
  committedCredits: number;
  costUsdPerCommittedCredit?: number;
  byProvider: Record<string, IProviderCostBucket>;
  byModel: Record<string, IProviderCostBucket>;
  byGenerationKind: Record<string, IProviderCostBucket>;
  updatedAt: string;
}

export interface IProviderCostBucket {
  knownCostUsd: number;
  eventCount: number;
  committedCredits: number;
  costUsdPerCredit?: number;
}

/** Firestore providerRateCatalog/{docId} document. */
export interface IProviderRateCatalogEntry {
  id: string;
  providerKind: LlmProviderKind;
  model: string;
  meter: ProviderCostMeter;
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  cachedInputUsdPer1M?: number;
  imageUsdPerMegapixel?: number;
  defaultSteps?: number;
  updatedAt?: string;
  source?: string;
}

/** Context threaded through generation via AsyncLocalStorage. */
export interface IProviderCostContext {
  userId: string;
  periodKey: string;
  generationKind?: GenerationKind;
  reservationId?: string;
  jobId?: string;
  recordId?: string;
  threadId?: string;
  llmSetupId?: string;
  userGroupId?: string;
  workflow?: GenerationWorkflow;
  modality?: LlmModality;
  callRole?: ProviderCostCallRole;
}

export interface IRecordProviderCallParams {
  providerKind: LlmProviderKind;
  connectionId: string;
  model: string;
  modality: LlmModality;
  usage?: IProviderUsageUnits | null;
  status: ProviderCostCallStatus;
  finishReason?: string;
  durationMs?: number;
  attempt?: number;
  callRole?: ProviderCostCallRole;
  workflow?: GenerationWorkflow;
  contextOverride?: Partial<IProviderCostContext>;
}
