import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { LlmSetupsTable } from '@admin/app/(app)/llm-setups/_components/LlmSetupsTable';
import { TableSkeleton } from '@admin/components/loading';
import { listLlmSetups } from '@admin/data/llm-setups';

async function LlmSetupsSection() {
  const setups = await listLlmSetups();
  return <LlmSetupsTable setups={setups} />;
}

export default function LlmSetupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="LLM setups"
          description="Define generation kind routing profiles. User groups reference these setups."
        />
        <Button asChild>
          <Link href="/llm-setups/new">Create setup</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={5} rows={5} />}>
        <LlmSetupsSection />
      </Suspense>
    </div>
  );
}
