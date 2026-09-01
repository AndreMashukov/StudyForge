import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { TableSkeleton } from '@admin/components/loading';
import { AgentKnowledgeTable } from '@admin/app/(app)/agent-knowledge/_components/AgentKnowledgeTable';
import { listPlatformAgentKnowledgeDocuments } from '@admin/data/platform-agent-knowledge';

async function AgentKnowledgeSection() {
  const documents = await listPlatformAgentKnowledgeDocuments();
  return <AgentKnowledgeTable documents={documents} />;
}

export default function AgentKnowledgePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Agent knowledge"
          description="Platform instructions for the workspace agent: generation policies, credit estimates, and artifact boundaries."
        />
        <Button asChild>
          <Link href="/agent-knowledge/new">Create document</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={4} rows={5} />}>
        <AgentKnowledgeSection />
      </Suspense>
    </div>
  );
}
