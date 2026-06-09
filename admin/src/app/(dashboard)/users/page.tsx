import { Suspense } from 'react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { TableSkeleton } from '../../../components/admin/loading';
import { UsersTable } from '../../../components/admin/UsersTable';
import { listUsers } from '../../../lib/data/users';

async function UsersTableSection() {
  const users = await listUsers({ limit: 50 });
  return <UsersTable users={users} />;
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="Read-only list from Firebase Auth and Firestore user profiles."
      />

      <Suspense fallback={<TableSkeleton columns={4} rows={6} />}>
        <UsersTableSection />
      </Suspense>
    </div>
  );
}
