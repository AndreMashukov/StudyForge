import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { UserGroupsTable } from '@admin/app/(app)/user-groups/_components/UserGroupsTable';
import { TableSkeleton } from '@admin/components/loading';
import { listUserGroups } from '@admin/data/user-groups';

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
          description="Create cohorts, link them to LLM and usage limits setups, and assign users manually."
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
