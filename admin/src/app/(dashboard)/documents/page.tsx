import { Suspense } from 'react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { TableSkeleton } from '../../../components/admin/loading';
import { listRecentDocuments } from '../../../lib/data/documents';

async function DocumentsTableSection() {
  const documents = await listRecentDocuments(25);

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No documents found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">
              Title
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              User ID
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={`${doc.userId}-${doc.id}`}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3 font-medium">{doc.title}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {doc.userId}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {doc.createdAt
                  ? new Date(doc.createdAt).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Documents"
        description="Recent documents sampled across users (read-only MVP)."
      />

      <Suspense fallback={<TableSkeleton columns={3} rows={8} />}>
        <DocumentsTableSection />
      </Suspense>
    </div>
  );
}
