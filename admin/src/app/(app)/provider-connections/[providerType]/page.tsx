import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '@admin/components/loading';
import { GeminiSettingsForm } from '@admin/app/(app)/provider-connections/_components/ModelSettingsPanel/GeminiSettingsForm';
import { MiniMaxSettingsForm } from '@admin/app/(app)/provider-connections/_components/ModelSettingsPanel/MiniMaxSettingsForm';
import { OpenRouterSettingsForm } from '@admin/app/(app)/provider-connections/_components/ModelSettingsPanel/OpenRouterSettingsForm';
import { TogetherSettingsForm } from '@admin/app/(app)/provider-connections/_components/ModelSettingsPanel/TogetherSettingsForm';
import {
  getModelProviderDefinition,
  isModelProviderType,
} from '@admin/domain/provider-connections/modelProviderRegistry';
import { getModelSettingsPageData } from '@admin/data/model-settings';

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
      <GeminiSettingsForm
        geminiConnection={pageData.geminiConnection}
        encryptionConfigured={pageData.encryptionConfigured}
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

  if (providerType === 'together') {
    return (
      <TogetherSettingsForm
        togetherConnection={pageData.togetherConnection}
        encryptionConfigured={pageData.encryptionConfigured}
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

  return (
    <GeminiSettingsForm
      geminiConnection={pageData.geminiConnection}
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
