import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { AgentKnowledgeForm } from '@admin/app/(app)/agent-knowledge/_components/AgentKnowledgeForm';

export default function NewAgentKnowledgePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/agent-knowledge"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to agent knowledge
      </Link>

      <AdminPageHeader
        title="Create agent knowledge document"
        description="Write markdown instructions the workspace agent should follow when planning generation."
      />

      <AgentKnowledgeForm
        defaultValues={{
          title: '',
          bodyMarkdown: '',
          tags: [],
        }}
      />
    </div>
  );
}
