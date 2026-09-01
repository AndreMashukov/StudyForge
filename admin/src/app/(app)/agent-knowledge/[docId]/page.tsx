import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { AgentKnowledgeForm } from '@admin/app/(app)/agent-knowledge/_components/AgentKnowledgeForm';
import { getPlatformAgentKnowledgeDocument } from '@admin/data/platform-agent-knowledge';

interface IPageProps {
  params: Promise<{ docId: string }>;
}

export default async function EditAgentKnowledgePage({ params }: IPageProps) {
  const { docId } = await params;
  const document = await getPlatformAgentKnowledgeDocument(docId);

  if (!document) {
    notFound();
  }

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
        title={document.title}
        description="Edit platform knowledge for the workspace agent."
      />

      <AgentKnowledgeForm
        docId={document.id}
        defaultValues={{
          title: document.title,
          bodyMarkdown: document.bodyMarkdown,
          tags: document.tags,
        }}
        status={document.status}
        indexingStatus={document.indexingStatus}
        indexingError={document.indexingError}
      />
    </div>
  );
}
