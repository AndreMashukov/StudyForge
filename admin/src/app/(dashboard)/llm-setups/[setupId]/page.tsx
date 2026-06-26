import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { LlmSetupForm } from '../../../../components/admin/LlmSetupForm';
import { routesToFormValues } from '../../../../components/admin/LlmSetupForm/LlmSetupForm.form';
import { getLlmSetupById } from '../../../../lib/data/llm-setups';
import { listProviderConnectionCatalog } from '../../../../lib/data/provider-connections';

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
        description={setup.description ?? 'Edit routing for this LLM setup.'}
      />

      <LlmSetupForm
        setupId={setup.id}
        defaultValues={routesToFormValues(setup.name, setup.description, setup.routes)}
        providerConnections={providerConnections}
        providerWarnings={setup.providerWarnings}
      />
    </div>
  );
}
