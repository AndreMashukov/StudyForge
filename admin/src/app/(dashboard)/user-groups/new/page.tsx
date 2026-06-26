import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { UserGroupForm } from '../../../../components/admin/UserGroupForm';
import { listLlmSetupOptions } from '../../../../lib/data/llm-setups';

export default async function NewUserGroupPage() {
  const setupOptions = await listLlmSetupOptions();

  return (
    <div className="space-y-6">
      <Link
        href="/user-groups"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to user groups
      </Link>

      <AdminPageHeader
        title="Create user group"
        description="Every group must reference one LLM setup."
      />

      <UserGroupForm
        defaultValues={{ name: '', llmSetupId: setupOptions[0]?.id ?? '' }}
        setupOptions={setupOptions}
      />
    </div>
  );
}
