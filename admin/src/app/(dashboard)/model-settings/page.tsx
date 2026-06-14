import { Suspense } from 'react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '../../../components/admin/loading';
import { ModelProviderOverview } from '../../../components/admin/ModelSettingsPanel/ModelProviderOverview';
import { buildProviderOverviewItems } from '../../../components/admin/ModelSettingsPanel/modelProviderFields';
import { getModelSettingsPageData } from '../../../lib/data/model-settings';

async function ModelSettingsSection() {
  const pageData = await getModelSettingsPageData();
  const providers = buildProviderOverviewItems({
    activeProviderId: pageData.activeProviderId,
    geminiConnection: pageData.geminiConnection,
    openRouterConnection: pageData.openRouterConnection,
  });

  return (
    <ModelProviderOverview
      activeProviderId={pageData.activeProviderId}
      providers={providers}
    />
  );
}

export default function ModelSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Model settings"
        description="Choose one active LLM provider for text, vision, and image generation. Configure provider details on each provider page."
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ModelSettingsSection />
      </Suspense>
    </div>
  );
}
