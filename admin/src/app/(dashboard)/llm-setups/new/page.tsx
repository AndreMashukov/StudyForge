import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { LlmSetupForm } from '../../../../components/admin/LlmSetupForm';
import { routesToFormValues } from '../../../../components/admin/LlmSetupForm/LlmSetupForm.form';
import { createDefaultLlmSetupRoutes } from '../../../../lib/data/llm-setups';

export default function NewLlmSetupPage() {
  const defaultRoutes = createDefaultLlmSetupRoutes();

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
        description="Choose provider and model for each modality."
      />

      <LlmSetupForm
        defaultValues={routesToFormValues('New setup', '', defaultRoutes)}
      />
    </div>
  );
}
