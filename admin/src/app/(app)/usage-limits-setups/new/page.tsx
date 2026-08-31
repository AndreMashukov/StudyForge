import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { USAGE_LIMITS_PROFILE_PRESETS } from '@shared-types';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { UsageLimitsSetupForm } from '@admin/app/(app)/usage-limits-setups/_components/UsageLimitsSetupForm';
import {
  buildPresetFormValues,
  buildPresetFeaturePolicies,
} from '@admin/data/usage-limits-setups';
import { featurePoliciesToFormValues } from '@admin/app/(app)/usage-limits-setups/_components/UsageLimitsSetupForm/UsageLimitsSetupForm.form';

export default function NewUsageLimitsSetupPage() {
  const defaultPreset = USAGE_LIMITS_PROFILE_PRESETS.find((preset) => preset.id === 'standard');
  const presetValues = defaultPreset
    ? buildPresetFormValues(defaultPreset)
    : {
        name: 'New setup',
        description: '',
        monthlyCreditAllowance: 1000,
        storageLimitBytes: USAGE_LIMITS_PROFILE_PRESETS[1]?.storageLimitBytes ?? 1024 * 1024 * 1024,
        dailySlideDeckLimit: USAGE_LIMITS_PROFILE_PRESETS[1]?.dailySlideDeckLimit ?? 5,
        isPublicPlan: false,
        isFreePlan: false,
        monthlyPriceCents: 0,
        stripePriceId: '',
        displayOrder: 0,
        featurePolicies: buildPresetFeaturePolicies(USAGE_LIMITS_PROFILE_PRESETS[0]),
      };

  return (
    <div className="space-y-6">
      <Link
        href="/usage-limits-setups"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to usage limits setups
      </Link>

      <AdminPageHeader
        title="Create usage limits setup"
        description="Configure monthly credits and per-feature costs for a user group plan."
      />

      <UsageLimitsSetupForm
        defaultValues={featurePoliciesToFormValues(
          presetValues.name,
          presetValues.description,
          presetValues.monthlyCreditAllowance,
          presetValues.storageLimitBytes,
          presetValues.dailySlideDeckLimit,
          presetValues.featurePolicies,
          {
            isPublicPlan: presetValues.isPublicPlan,
            isFreePlan: presetValues.isFreePlan,
            monthlyPriceCents: presetValues.monthlyPriceCents,
            stripePriceId: presetValues.stripePriceId,
            displayOrder: presetValues.displayOrder,
          },
        )}
      />
    </div>
  );
}
