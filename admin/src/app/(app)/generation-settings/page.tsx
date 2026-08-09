import { Suspense } from 'react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '@admin/components/loading';
import { readLlmGenerationSettings } from '@admin/data/llm-generation-settings';
import { LlmGenerationSettingsForm } from './_components/LlmGenerationSettingsForm';

export const dynamic = 'force-dynamic';

async function GenerationSettingsSection() {
  const settings = await readLlmGenerationSettings();

  return <LlmGenerationSettingsForm settings={settings} />;
}

export default function GenerationSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Generation settings"
        description="Manage platform-wide defaults for LLM provider calls."
      />

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <GenerationSettingsSection />
      </Suspense>
    </div>
  );
}
