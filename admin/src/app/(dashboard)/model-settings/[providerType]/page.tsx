import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '../../../../components/admin/loading';
import { GeminiSettingsPanel } from '../../../../components/admin/ModelSettingsPanel/GeminiSettingsPanel';
import { OpenRouterSettingsForm } from '../../../../components/admin/ModelSettingsPanel/OpenRouterSettingsForm';
import {
  getModelProviderDefinition,
  isModelProviderType,
} from '../../../../components/admin/ModelSettingsPanel/modelProviderRegistry';
import { getModelSettingsPageData } from '../../../../lib/data/model-settings';

async function ProviderSettingsSection({
  providerType,
}: {
  providerType: string;
}) {
  if (!isModelProviderType(providerType)) {
    notFound();
  }

  const pageData = await getModelSettingsPageData();

  if (providerType === 'gemini') {
    return (
      <GeminiSettingsPanel
        geminiConnection={pageData.geminiConnection}
        openRouterConnection={pageData.openRouterConnection}
        activeProviderId={pageData.activeProviderId}
      />
    );
  }

  if (providerType === 'openrouter') {
    return (
      <OpenRouterSettingsForm
        openRouterConnection={pageData.openRouterConnection}
        encryptionConfigured={pageData.encryptionConfigured}
      />
    );
  }

  notFound();
}

export default async function ProviderSettingsPage({
  params,
}: {
  params: Promise<{ providerType: string }>;
}) {
  const { providerType } = await params;

  if (!isModelProviderType(providerType)) {
    notFound();
  }

  const definition = getModelProviderDefinition(providerType);

  return (
    <div className="space-y-6">
      <Link
        href="/model-settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to model settings
      </Link>

      <AdminPageHeader
        title={`${definition.label} settings`}
        description={
          definition.isEditable
            ? `Configure ${definition.label} connection details. Activation is managed from the model settings overview.`
            : definition.description
        }
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ProviderSettingsSection providerType={providerType} />
      </Suspense>
    </div>
  );
}
