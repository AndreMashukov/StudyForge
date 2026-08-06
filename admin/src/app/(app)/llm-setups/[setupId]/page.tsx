import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { LlmSetupForm } from '@admin/app/(app)/llm-setups/_components/LlmSetupForm';
import { generationRoutesToFormValues } from '@admin/app/(app)/llm-setups/_components/LlmSetupForm/LlmSetupForm.form';
import { getLlmSetupById } from '@admin/data/llm-setups';
import { listProviderConnectionCatalog } from '@admin/data/provider-connections';

export default async function LlmSetupDetailPage({
  params,
}: {
  params: Promise<{ setupId: string }>;
}) {
  const { setupId } = await params;
  const [setup, providerConnections] = await Promise.all([
    getLlmSetupById(setupId),
    listProviderConnectionCatalog(),
  ]);

  if (!setup) {
    notFound();
  }

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
        title={setup.name}
        description={setup.description ?? 'Edit generation routing for this LLM setup.'}
      />

      <LlmSetupForm
        setupId={setup.id}
        defaultValues={generationRoutesToFormValues(
          setup.name,
          setup.description,
          setup.generationRoutes
        )}
        providerConnections={providerConnections}
        providerWarnings={setup.providerWarnings}
      />
    </div>
  );
}
