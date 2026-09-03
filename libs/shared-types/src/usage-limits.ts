import type { GenerationKind } from './generation-kind-metadata';
import { ALL_GENERATION_KINDS } from './generation-kind-metadata';
import type { IUsagePayAsYouGoSummary } from './billing';

export type UsageLimitEventType =
  | 'reserve'
  | 'commit'
  | 'refund'
  | 'block'
  | 'overage_reserve'
  | 'overage_commit'
  | 'overage_refund'
  | 'billing_enabled'
  | 'billing_disabled';

export type UsageLimitErrorCode =
  | 'USER_GROUP_NOT_ASSIGNED'
  | 'USER_GROUP_NOT_FOUND'
  | 'USAGE_LIMITS_SETUP_NOT_FOUND'
  | 'FEATURE_DISABLED'
  | 'INSUFFICIENT_CREDITS'
  | 'PAY_AS_YOU_GO_DISABLED'
  | 'PAYMENT_METHOD_REQUIRED'
  | 'OVERAGE_CAP_EXCEEDED'
  | 'STORAGE_LIMIT_EXCEEDED'
  | 'DAILY_SLIDE_DECK_LIMIT_EXCEEDED';

export interface IUsageFeaturePolicy {
  enabled: boolean;
  creditCost: number;
}

export type IUsageFeaturePolicies = Record<GenerationKind, IUsageFeaturePolicy>;

export interface IUsageLimitsSetup {
  id: string;
  name: string;
  description?: string;
  monthlyCreditAllowance: number;
  /** Maximum durable Storage bytes per user on this setup. */
  storageLimitBytes: number;
  /** Maximum slide-deck generation jobs started per UTC day. */
  dailySlideDeckLimit: number;
  featurePolicies: IUsageFeaturePolicies;
  /** True when this setup can be shown as a selectable plan in the web app. */
  isPublicPlan?: boolean;
  /** True for the free plan used for registration fallback and cancellation fallback. */
  isFreePlan?: boolean;
  /** Monthly recurring subscription price in cents. Omit for the free plan. */
  monthlyPriceCents?: number;
  /** Stripe recurring price ID for paid subscription checkout and webhook mapping. */
  stripePriceId?: string;
  /** Lower values are displayed first in user-facing plan lists. */
  displayOrder?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ICreateUsageLimitsSetupRequest {
  name: string;
  description?: string;
  monthlyCreditAllowance: number;
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
  featurePolicies: IUsageFeaturePolicies;
  isPublicPlan?: boolean;
  isFreePlan?: boolean;
  monthlyPriceCents?: number;
  stripePriceId?: string;
  displayOrder?: number;
}

export interface IUpdateUsageLimitsSetupRequest {
  name?: string;
  description?: string;
  monthlyCreditAllowance?: number;
  storageLimitBytes?: number;
  dailySlideDeckLimit?: number;
  featurePolicies?: IUsageFeaturePolicies;
  isPublicPlan?: boolean;
  isFreePlan?: boolean;
  monthlyPriceCents?: number;
  stripePriceId?: string;
  displayOrder?: number;
}

export interface IUsagePeriodSummary {
  periodKey: string;
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
  remainingCredits: number;
  reservedOverageCredits?: number;
  spentOverageCredits?: number;
  overageAmountCents?: number;
  invoicedOverageAmountCents?: number;
  resetAt: string;
  usageLimitsSetupId: string;
  usageLimitsSetupName?: string;
}

export interface IUsageFeatureAvailability {
  kind: GenerationKind;
  enabled: boolean;
  creditCost: number;
  affordable: boolean;
  /** True when the action would draw from pay-as-you-go overage. */
  usesOverage?: boolean;
}

export interface IUsageStorageSummary {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
}

export interface IUsageDailySlideDeckSummary {
  dayKey: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface IUserUsageSummary {
  periodKey: string;
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
  remainingCredits: number;
  reservedOverageCredits?: number;
  spentOverageCredits?: number;
  overageAmountCents?: number;
  resetAt: string;
  usageLimitsSetupId: string;
  usageLimitsSetupName?: string;
  featureAvailability: IUsageFeatureAvailability[];
  payAsYouGo?: IUsagePayAsYouGoSummary;
  storage?: IUsageStorageSummary;
  dailySlideDecks?: IUsageDailySlideDeckSummary;
}

export interface ISubscriptionPlanSummary {
  usageLimitsSetupId: string;
  name: string;
  description?: string;
  monthlyCreditAllowance: number;
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
  monthlyPriceCents: number;
  stripePriceId?: string;
  isFreePlan: boolean;
  displayOrder: number;
}

export interface IUsageLimitEvent {
  id: string;
  type: UsageLimitEventType;
  userId: string;
  userGroupId: string;
  usageLimitsSetupId: string;
  llmSetupId?: string;
  generationKind: GenerationKind;
  credits: number;
  includedCredits?: number;
  overageCredits?: number;
  overageAmountCents?: number;
  periodKey: string;
  reservationId?: string;
  createdAt: string;
}

/** Recommended default credit costs per generation kind. */
export const DEFAULT_USAGE_CREDIT_COSTS: Record<GenerationKind, number> = {
  directoryChat: 1,
  documentQuestion: 1,
  quizFollowup: 1,
  documentRevise: 3,
  ruleGeneration: 3,
  agentKnowledgeEmbedding: 3,
  quiz: 5,
  sequenceQuiz: 5,
  matchQuiz: 5,
  sourceDocumentEnhancement: 5,
  flashcards: 10,
  diagramQuiz: 10,
  slideDeckImage: 10,
  documentFromPrompt: 20,
  documentFromScreenshot: 25,
  slideDeckText: 30,
  directoryAgent: 1,
  agentExecutor: 1,
};

/** Premium generation kinds disabled on the Free profile. */
export const FREE_TIER_DISABLED_KINDS: GenerationKind[] = [
  'documentFromScreenshot',
  'slideDeckText',
  'slideDeckImage',
  'flashcards',
  'diagramQuiz',
];

/** 100 MB */
export const FREE_TIER_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;
/** 2 GB */
export const STANDARD_TIER_STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
/** 8 GB */
export const PRO_TIER_STORAGE_LIMIT_BYTES = 8 * 1024 * 1024 * 1024;
/** 20 GB */
export const POWER_TIER_STORAGE_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;

export interface IUsageLimitsProfilePreset {
  id: string;
  name: string;
  description: string;
  monthlyCreditAllowance: number;
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
  disabledKinds?: GenerationKind[];
}

export const USAGE_LIMITS_PROFILE_PRESETS: IUsageLimitsProfilePreset[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Limited monthly credits with premium features disabled.',
    monthlyCreditAllowance: 150,
    storageLimitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 1,
    disabledKinds: FREE_TIER_DISABLED_KINDS,
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Normal learner allowance with all features enabled.',
    monthlyCreditAllowance: 2_000,
    storageLimitBytes: STANDARD_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 8,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher allowance for active learners.',
    monthlyCreditAllowance: 8_000,
    storageLimitBytes: PRO_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 25,
  },
  {
    id: 'power',
    name: 'Power',
    description: 'Internal or heavy-user allowance.',
    monthlyCreditAllowance: 25_000,
    storageLimitBytes: POWER_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 100,
  },
];

export function createDefaultFeaturePolicies(options?: {
  disabledKinds?: GenerationKind[];
}): IUsageFeaturePolicies {
  const disabled = new Set(options?.disabledKinds ?? []);
  const policies = {} as IUsageFeaturePolicies;

  for (const kind of ALL_GENERATION_KINDS) {
    policies[kind] = {
      enabled: !disabled.has(kind),
      creditCost: DEFAULT_USAGE_CREDIT_COSTS[kind],
    };
  }

  return policies;
}

export function buildUsagePeriodKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildUsagePeriodResetAt(periodKey: string): string {
  const [yearPart, monthPart] = periodKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(`Invalid usage period key: ${periodKey}`);
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(
    Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0),
  ).toISOString();
}

export function buildUsageDayKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildUsageDayResetAt(dayKey: string): string {
  const [yearPart, monthPart, dayPart] = dayKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid usage day key: ${dayKey}`);
  }

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return nextDay.toISOString();
}

export function calculateRemainingStorageBytes(params: {
  limitBytes: number;
  usedBytes: number;
}): number {
  return Math.max(0, params.limitBytes - params.usedBytes);
}

export function calculateDailySlideDecksUsed(params: {
  reservedSlideDecks: number;
  completedSlideDecks: number;
}): number {
  return params.reservedSlideDecks + params.completedSlideDecks;
}

export function calculateRemainingDailySlideDecks(params: {
  limit: number;
  reservedSlideDecks: number;
  completedSlideDecks: number;
}): number {
  const used = calculateDailySlideDecksUsed(params);
  return Math.max(0, params.limit - used);
}

export function resolveLegacySetupQuotaDefaults(setupName: string): {
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
} {
  const preset = USAGE_LIMITS_PROFILE_PRESETS.find(
    (entry) => entry.name.toLowerCase() === setupName.trim().toLowerCase(),
  );
  if (preset) {
    return {
      storageLimitBytes: preset.storageLimitBytes,
      dailySlideDeckLimit: preset.dailySlideDeckLimit,
    };
  }

  return resolvePresetQuotaDefaults('standard');
}

export function resolvePresetQuotaDefaults(presetId: string): {
  storageLimitBytes: number;
  dailySlideDeckLimit: number;
} {
  const preset = USAGE_LIMITS_PROFILE_PRESETS.find(
    (entry) => entry.id === presetId,
  );
  if (preset) {
    return {
      storageLimitBytes: preset.storageLimitBytes,
      dailySlideDeckLimit: preset.dailySlideDeckLimit,
    };
  }

  return {
    storageLimitBytes: STANDARD_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 8,
  };
}

/**
 * Credit allowance for the open period follows the user's live usage limits setup.
 * Mid-period group or setup changes take effect immediately. Spent and reserved
 * credits are not reset.
 */
export function resolveLivePeriodAllowance(liveSetupAllowance: number): number {
  return liveSetupAllowance;
}

export function calculateRemainingCredits(params: {
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
}): number {
  const used = params.reservedCredits + params.spentCredits;
  return Math.max(0, params.allowance - used);
}

export function calculateUsageCreditCharge(
  policy: IUsageFeaturePolicy,
  quantity = 1,
): number {
  const normalizedQuantity =
    Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
  return policy.creditCost * normalizedQuantity;
}

/** Max credits held for one workspace/directory agent turn before USD true-up. */
export const AGENT_LOOP_CREDIT_CAP = 50;

/** Multiplier applied to recorded provider USD before converting to credits. */
export const AGENT_LOOP_USD_MARKUP = 2;

/** Credits charged for each loop call whose provider cost is unknown. */
export const AGENT_LOOP_UNKNOWN_CALL_CREDITS = 1;

export interface ICalculateAgentLoopCreditsParams {
  knownCostUsd: number;
  unknownCallCount: number;
  pricePerCreditCents: number;
  reservedCredits: number;
  billableEventCount?: number;
}

/**
 * Credits to commit for an agent tool-loop after provider events are recorded.
 * Caps at the hold. Zero events and zero cost refunds the hold.
 */
export function calculateAgentLoopCredits(
  params: ICalculateAgentLoopCreditsParams,
): number {
  const reserved = Number.isFinite(params.reservedCredits)
    ? Math.max(0, Math.floor(params.reservedCredits))
    : 0;
  if (reserved <= 0) {
    return 0;
  }

  const unknownCalls = Number.isFinite(params.unknownCallCount)
    ? Math.max(0, Math.floor(params.unknownCallCount))
    : 0;
  const unknownCredits = unknownCalls * AGENT_LOOP_UNKNOWN_CALL_CREDITS;

  const knownCostUsd =
    Number.isFinite(params.knownCostUsd) && params.knownCostUsd > 0
      ? params.knownCostUsd
      : 0;
  const pricePerCreditCents =
    Number.isFinite(params.pricePerCreditCents) && params.pricePerCreditCents > 0
      ? params.pricePerCreditCents
      : 0;
  const usdCredits =
    knownCostUsd > 0 && pricePerCreditCents > 0
      ? Math.ceil(
          (knownCostUsd * AGENT_LOOP_USD_MARKUP * 100) / pricePerCreditCents,
        )
      : 0;

  const billed = usdCredits + unknownCredits;
  if (billed > 0) {
    return Math.min(reserved, billed);
  }

  const billableEventCount = Number.isFinite(params.billableEventCount)
    ? Math.max(0, Math.floor(params.billableEventCount ?? 0))
    : 0;
  if (billableEventCount > 0) {
    return Math.min(reserved, 1);
  }

  return 0;
}
