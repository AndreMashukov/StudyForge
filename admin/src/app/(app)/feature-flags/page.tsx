import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { readFeatureFlags } from '@admin/data/feature-flags';
import { FeatureFlagsForm } from './_components/FeatureFlagsForm/FeatureFlagsForm';

export const dynamic = 'force-dynamic';

export default async function FeatureFlagsPage() {
  const flags = await readFeatureFlags();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Feature flags"
        description="Turn product surfaces on or off without a StudyForge deploy."
      />
      <FeatureFlagsForm flags={flags} />
    </div>
  );
}
