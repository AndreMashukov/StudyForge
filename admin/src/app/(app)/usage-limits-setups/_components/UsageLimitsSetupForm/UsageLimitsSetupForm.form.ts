import type { GenerationKind, IUsageFeaturePolicies } from '@shared-types';
import {
  ADMIN_CONFIGURABLE_GENERATION_KINDS,
  ALL_GENERATION_KINDS,
  createDefaultFeaturePolicies,
  GENERATION_KIND_METADATA,
  STANDARD_TIER_STORAGE_LIMIT_BYTES,
} from '@shared-types';
import { z } from 'zod';

const BYTES_PER_MEGABYTE = 1024 * 1024;

export function bytesToStorageLimitMegabytes(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MEGABYTE);
}

export function storageLimitMegabytesToBytes(megabytes: number): number {
  return Math.max(0, Math.round(megabytes * BYTES_PER_MEGABYTE));
}

export function formatStorageLimitLabel(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${Math.round(bytes / BYTES_PER_MEGABYTE)} MB`;
}

const featurePolicySchema = z.object({
  enabled: z.boolean(),
  creditCost: z.number().int().min(0, 'Credit cost must be zero or greater'),
});

const featurePoliciesShape = Object.fromEntries(
  ALL_GENERATION_KINDS.map((kind) => [kind, featurePolicySchema])
) as Record<GenerationKind, typeof featurePolicySchema>;

export const usageLimitsSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  monthlyCreditAllowance: z.number().int().min(0, 'Allowance must be zero or greater'),
  storageLimitMegabytes: z.number().int().min(1, 'Storage limit must be at least 1 MB'),
  dailySlideDeckLimit: z.number().int().min(0, 'Daily slide deck limit must be zero or greater'),
  featurePolicies: z.object(featurePoliciesShape),
});

export type IUsageLimitsSetupFormValues = z.infer<typeof usageLimitsSetupFormSchema>;

export function createEmptyFeaturePolicyFormValues(): IUsageFeaturePolicies {
  return createDefaultFeaturePolicies();
}

export function toFeaturePolicies(values: IUsageLimitsSetupFormValues): IUsageFeaturePolicies {
  const policies = createDefaultFeaturePolicies();

  for (const kind of ALL_GENERATION_KINDS) {
    policies[kind] = {
      enabled: values.featurePolicies[kind].enabled,
      creditCost: values.featurePolicies[kind].creditCost,
    };
  }

  return policies;
}

export function featurePoliciesToFormValues(
  name: string,
  description: string | undefined,
  monthlyCreditAllowance: number,
  storageLimitBytes: number,
  dailySlideDeckLimit: number,
  featurePolicies: IUsageFeaturePolicies
): IUsageLimitsSetupFormValues {
  const policies = createEmptyFeaturePolicyFormValues();

  for (const kind of ALL_GENERATION_KINDS) {
    policies[kind] = {
      enabled: featurePolicies[kind]?.enabled ?? false,
      creditCost: featurePolicies[kind]?.creditCost ?? 0,
    };
  }

  return {
    name,
    description: description ?? '',
    monthlyCreditAllowance,
    storageLimitMegabytes: bytesToStorageLimitMegabytes(
      storageLimitBytes > 0 ? storageLimitBytes : STANDARD_TIER_STORAGE_LIMIT_BYTES,
    ),
    dailySlideDeckLimit,
    featurePolicies: policies,
  };
}

export function getUsageFeatureGroups(): Array<{
  id: 'production' | 'interactive' | 'slideDeck';
  label: string;
  kinds: GenerationKind[];
}> {
  return [
    {
      id: 'production',
      label: 'Production generation',
      kinds: ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'production'
      ),
    },
    {
      id: 'interactive',
      label: 'Interactive',
      kinds: [
        ...ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
          (kind) => GENERATION_KIND_METADATA[kind].group === 'interactive'
        ),
        'directoryAgent',
        'agentKnowledgeEmbedding',
      ],
    },
    {
      id: 'slideDeck',
      label: 'Slide deck',
      kinds: ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'slideDeck'
      ),
    },
  ];
}
