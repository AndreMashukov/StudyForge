import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '../../../../components/admin/loading';
import { GeminiSettingsPanel } from '../../../../components/admin/ModelSettingsPanel/GeminiSettingsPanel';
import { MiniMaxSettingsForm } from '../../../../components/admin/ModelSettingsPanel/MiniMaxSettingsForm';
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
        miniMaxConnection={pageData.miniMaxConnection}
      />
    );
  }

  if (providerType === 'minimax') {
    return (
      <MiniMaxSettingsForm
        miniMaxConnection={pageData.miniMaxConnection}
        encryptionConfigured={pageData.encryptionConfigured}
      />
    );
  }

  return (
    <OpenRouterSettingsForm
      openRouterConnection={pageData.openRouterConnection}
      encryptionConfigured={pageData.encryptionConfigured}
    />
  );
}

export default async function ProviderConnectionDetailPage({
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
        href="/provider-connections"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to provider connections
      </Link>

      <AdminPageHeader
        title={`${definition.label} connection`}
        description={definition.description}
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ProviderSettingsSection providerType={providerType} />
      </Suspense>
    </div>
  );
}
