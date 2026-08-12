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
}

export interface IUpdateUsageLimitsSetupRequest {
  name?: string;
  description?: string;
  monthlyCreditAllowance?: number;
  storageLimitBytes?: number;
  dailySlideDeckLimit?: number;
  featurePolicies?: IUsageFeaturePolicies;
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
  sourceDocumentEnhancement: 5,
  flashcards: 10,
  diagramQuiz: 10,
  slideDeckImage: 10,
  documentFromPrompt: 20,
  documentFromScreenshot: 25,
  slideDeckText: 30,
  directoryAgent: 1,
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
/** 1 GB */
export const STANDARD_TIER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
/** 5 GB */
export const PRO_TIER_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
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
    monthlyCreditAllowance: 100,
    storageLimitBytes: FREE_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 1,
    disabledKinds: FREE_TIER_DISABLED_KINDS,
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Normal learner allowance with all features enabled.',
    monthlyCreditAllowance: 1_000,
    storageLimitBytes: STANDARD_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 5,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher allowance for active learners.',
    monthlyCreditAllowance: 5_000,
    storageLimitBytes: PRO_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 20,
  },
  {
    id: 'power',
    name: 'Power',
    description: 'Internal or heavy-user allowance.',
    monthlyCreditAllowance: 20_000,
    storageLimitBytes: POWER_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 100,
  },
];

export function createDefaultFeaturePolicies(
  options?: { disabledKinds?: GenerationKind[] }
): IUsageFeaturePolicies {
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
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid usage period key: ${periodKey}`);
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0)).toISOString();
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

export function resolvePresetQuotaDefaults(
  presetId: string,
): { storageLimitBytes: number; dailySlideDeckLimit: number } {
  const preset = USAGE_LIMITS_PROFILE_PRESETS.find((entry) => entry.id === presetId);
  if (preset) {
    return {
      storageLimitBytes: preset.storageLimitBytes,
      dailySlideDeckLimit: preset.dailySlideDeckLimit,
    };
  }

  return {
    storageLimitBytes: STANDARD_TIER_STORAGE_LIMIT_BYTES,
    dailySlideDeckLimit: 5,
  };
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
  quantity = 1
): number {
  const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
  return policy.creditCost * normalizedQuantity;
}
