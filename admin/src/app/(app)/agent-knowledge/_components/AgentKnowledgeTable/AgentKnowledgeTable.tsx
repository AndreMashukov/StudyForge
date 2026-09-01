'use client';

import Link from 'next/link';
import type { IPlatformAgentKnowledgeDocument } from '@shared-types';
import { Badge } from '@admin/components/ui/Badge';

export interface IAgentKnowledgeTableProps {
  documents: IPlatformAgentKnowledgeDocument[];
}

function statusVariant(
  status: IPlatformAgentKnowledgeDocument['status'],
): 'default' | 'secondary' | 'outline' {
  return status === 'published' ? 'default' : 'secondary';
}

function indexingLabel(document: IPlatformAgentKnowledgeDocument): string {
  if (document.status !== 'published') {
    return 'Not indexed';
  }
  if (document.indexingStatus === 'indexing') {
    return 'Indexing';
  }
  if (document.indexingStatus === 'failed') {
    return document.indexingError ? `Failed: ${document.indexingError}` : 'Failed';
  }
  if (document.indexingStatus === 'indexed') {
    return 'Indexed';
  }
  return 'Pending index';
}

export function AgentKnowledgeTable({ documents }: IAgentKnowledgeTableProps) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No platform knowledge documents yet. Create one to teach the workspace agent how to generate content.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Indexing</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {documents.map((document) => (
            <tr key={document.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <Link
                  href={`/agent-knowledge/${document.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {document.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(document.status)}>{document.status}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{indexingLabel(document)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(document.updatedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
