import type { GenerationKind } from './generation-kind-metadata';
import { ALL_GENERATION_KINDS } from './generation-kind-metadata';

export type UsageLimitEventType = 'reserve' | 'commit' | 'refund' | 'block';

export type UsageLimitErrorCode =
  | 'USER_GROUP_NOT_ASSIGNED'
  | 'USER_GROUP_NOT_FOUND'
  | 'USAGE_LIMITS_SETUP_NOT_FOUND'
  | 'FEATURE_DISABLED'
  | 'INSUFFICIENT_CREDITS';

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
  featurePolicies: IUsageFeaturePolicies;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ICreateUsageLimitsSetupRequest {
  name: string;
  description?: string;
  monthlyCreditAllowance: number;
  featurePolicies: IUsageFeaturePolicies;
}

export interface IUpdateUsageLimitsSetupRequest {
  name?: string;
  description?: string;
  monthlyCreditAllowance?: number;
  featurePolicies?: IUsageFeaturePolicies;
}

export interface IUsagePeriodSummary {
  periodKey: string;
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
  remainingCredits: number;
  resetAt: string;
  usageLimitsSetupId: string;
  usageLimitsSetupName?: string;
}

export interface IUsageFeatureAvailability {
  kind: GenerationKind;
  enabled: boolean;
  creditCost: number;
  affordable: boolean;
}

export interface IUserUsageSummary {
  periodKey: string;
  allowance: number;
  reservedCredits: number;
  spentCredits: number;
  refundedCredits: number;
  remainingCredits: number;
  resetAt: string;
  usageLimitsSetupId: string;
  usageLimitsSetupName?: string;
  featureAvailability: IUsageFeatureAvailability[];
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

export interface IUsageLimitsProfilePreset {
  id: string;
  name: string;
  description: string;
  monthlyCreditAllowance: number;
  disabledKinds?: GenerationKind[];
}

export const USAGE_LIMITS_PROFILE_PRESETS: IUsageLimitsProfilePreset[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Limited monthly credits with premium features disabled.',
    monthlyCreditAllowance: 100,
    disabledKinds: FREE_TIER_DISABLED_KINDS,
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Normal learner allowance with all features enabled.',
    monthlyCreditAllowance: 1_000,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Higher allowance for active learners.',
    monthlyCreditAllowance: 5_000,
  },
  {
    id: 'power',
    name: 'Power',
    description: 'Internal or heavy-user allowance.',
    monthlyCreditAllowance: 20_000,
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
