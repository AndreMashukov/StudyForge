import { Suspense } from 'react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '@admin/components/loading';
import { ProviderConnectionsOverview } from '@admin/app/(app)/provider-connections/_components/ProviderConnectionsPanel/ProviderConnectionsOverview';
import { getModelSettingsPageData } from '@admin/data/model-settings';

async function ProviderConnectionsSection() {
  const pageData = await getModelSettingsPageData();

  return (
    <ProviderConnectionsOverview
      geminiConnection={pageData.geminiConnection}
      openRouterConnection={pageData.openRouterConnection}
      miniMaxConnection={pageData.miniMaxConnection}
      togetherConnection={pageData.togetherConnection}
      encryptionConfigured={pageData.encryptionConfigured}
    />
  );
}

export default function ProviderConnectionsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Provider connections"
        description="Manage shared provider credentials used by LLM setups."
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ProviderConnectionsSection />
      </Suspense>
    </div>
  );
}
