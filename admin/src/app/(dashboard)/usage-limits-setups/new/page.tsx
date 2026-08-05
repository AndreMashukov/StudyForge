import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { USAGE_LIMITS_PROFILE_PRESETS } from '@shared-types';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { UsageLimitsSetupForm } from '../../../../components/admin/UsageLimitsSetupForm';
import {
  buildPresetFormValues,
  buildPresetFeaturePolicies,
} from '../../../../lib/data/usage-limits-setups';
import { featurePoliciesToFormValues } from '../../../../components/admin/UsageLimitsSetupForm/UsageLimitsSetupForm.form';

export default function NewUsageLimitsSetupPage() {
  const defaultPreset = USAGE_LIMITS_PROFILE_PRESETS.find((preset) => preset.id === 'standard');
  const presetValues = defaultPreset
    ? buildPresetFormValues(defaultPreset)
    : {
        name: 'New setup',
        description: '',
        monthlyCreditAllowance: 1000,
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
          presetValues.featurePolicies
        )}
      />
    </div>
  );
}
