import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { LlmSetupForm } from '@admin/app/(app)/llm-setups/_components/LlmSetupForm';
import { generationRoutesToFormValues } from '@admin/app/(app)/llm-setups/_components/LlmSetupForm/LlmSetupForm.form';
import { createDefaultGenerationRoutes } from '@admin/data/llm-setups';
import { listProviderConnectionCatalog } from '@admin/data/provider-connections';

export default async function NewLlmSetupPage() {
  const [defaultGenerationRoutes, providerConnections] = await Promise.all([
    createDefaultGenerationRoutes(),
    listProviderConnectionCatalog(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/llm-setups"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to LLM setups
      </Link>

      <AdminPageHeader
        title="Create LLM setup"
        description="Configure provider connection, model, and workflow for each generation kind."
      />

      <LlmSetupForm
        defaultValues={generationRoutesToFormValues('New setup', '', defaultGenerationRoutes)}
        providerConnections={providerConnections}
      />
    </div>
  );
}
