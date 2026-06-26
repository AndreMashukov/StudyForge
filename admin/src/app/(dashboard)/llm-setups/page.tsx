import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { LlmSetupsTable } from '../../../components/admin/LlmSetupsTable';
import { TableSkeleton } from '../../../components/admin/loading';
import { listLlmSetups } from '../../../lib/data/llm-setups';

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
          description="Define text, vision, and image routing profiles. User groups reference these setups."
        />
        <Button asChild>
          <Link href="/llm-setups/new">Create setup</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={6} rows={5} />}>
        <LlmSetupsSection />
      </Suspense>
    </div>
  );
}
