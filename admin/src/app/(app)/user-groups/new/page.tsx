import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { UserGroupForm } from '@admin/app/(app)/user-groups/_components/UserGroupForm';
import { listLlmSetupOptions } from '@admin/data/llm-setups';
import { listUsageLimitsSetupOptions } from '@admin/data/usage-limits-setups';

export default async function NewUserGroupPage() {
  const [setupOptions, usageLimitsSetupOptions] = await Promise.all([
    listLlmSetupOptions(),
    listUsageLimitsSetupOptions(),
  ]);

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
        description="Every group must reference one LLM setup and one usage limits setup."
      />

      <UserGroupForm
        defaultValues={{
          name: '',
          llmSetupId: setupOptions[0]?.id ?? '',
          usageLimitsSetupId: usageLimitsSetupOptions[0]?.id ?? '',
          isDefaultRegistrationGroup: false,
        }}
        setupOptions={setupOptions}
        usageLimitsSetupOptions={usageLimitsSetupOptions}
      />
    </div>
  );
}
