import { ModelSettingsPanel } from '../../../components/admin/ModelSettingsPanel';
import { getModelSettingsPageData } from '../../../lib/data/model-settings';

export default async function ModelSettingsPage() {
  const { geminiConnection, openRouterConnection, encryptionConfigured } =
    await getModelSettingsPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Model settings</h1>
        <p className="text-muted-foreground">
          Gemini stays on the existing server-managed key. OpenRouter can be
          configured and tested from this admin panel.
        </p>
      </div>

      <ModelSettingsPanel
        geminiConnection={geminiConnection}
        openRouterConnection={openRouterConnection}
        encryptionConfigured={encryptionConfigured}
      />
    </div>
  );
}