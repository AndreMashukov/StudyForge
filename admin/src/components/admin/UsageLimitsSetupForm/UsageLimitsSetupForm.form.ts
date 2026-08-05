import type { GenerationKind, IUsageFeaturePolicies } from '@shared-types';
import {
  ADMIN_CONFIGURABLE_GENERATION_KINDS,
  ALL_GENERATION_KINDS,
  createDefaultFeaturePolicies,
  GENERATION_KIND_METADATA,
} from '@shared-types';
import { z } from 'zod';

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
