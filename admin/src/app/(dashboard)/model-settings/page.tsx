import { Suspense } from 'react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '../../../components/admin/loading';
import { ModelSettingsPanel } from '../../../components/admin/ModelSettingsPanel';
import { getModelSettingsPageData } from '../../../lib/data/model-settings';

async function ModelSettingsSection() {
  const { geminiConnection, openRouterConnection, encryptionConfigured } =
    await getModelSettingsPageData();

  return (
    <ModelSettingsPanel
      geminiConnection={geminiConnection}
      openRouterConnection={openRouterConnection}
      encryptionConfigured={encryptionConfigured}
    />
  );
}

export default function ModelSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Model settings"
        description="Gemini stays on the existing server-managed key. OpenRouter models can be configured and tested from this admin panel."
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ModelSettingsSection />
      </Suspense>
    </div>
  );
}
