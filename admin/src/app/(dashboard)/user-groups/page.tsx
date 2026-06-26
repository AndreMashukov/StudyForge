import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { UserGroupsTable } from '../../../components/admin/UserGroupsTable';
import { TableSkeleton } from '../../../components/admin/loading';
import { listUserGroups } from '../../../lib/data/user-groups';

async function UserGroupsSection() {
  const groups = await listUserGroups();
  return <UserGroupsTable groups={groups} />;
}

export default function UserGroupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="User groups"
          description="Create cohorts, link them to LLM setups, and assign users manually."
        />
        <Button asChild>
          <Link href="/user-groups/new">Create group</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={3} rows={5} />}>
        <UserGroupsSection />
      </Suspense>
    </div>
  );
}
