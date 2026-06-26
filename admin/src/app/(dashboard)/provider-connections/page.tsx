import { Suspense } from 'react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '../../../components/admin/loading';
import { ProviderConnectionsOverview } from '../../../components/admin/ProviderConnectionsPanel/ProviderConnectionsOverview';
import { getModelSettingsPageData } from '../../../lib/data/model-settings';

async function ProviderConnectionsSection() {
  const pageData = await getModelSettingsPageData();

  return (
    <ProviderConnectionsOverview
      geminiConnection={pageData.geminiConnection}
      openRouterConnection={pageData.openRouterConnection}
      miniMaxConnection={pageData.miniMaxConnection}
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
