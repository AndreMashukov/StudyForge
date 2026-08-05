import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@study-forge/ui';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader';
import { UsageLimitsSetupsTable } from '../../../components/admin/UsageLimitsSetupsTable';
import { TableSkeleton } from '../../../components/admin/loading';
import { listUsageLimitsSetups } from '../../../lib/data/usage-limits-setups';

async function UsageLimitsSetupsSection() {
  const setups = await listUsageLimitsSetups();
  return <UsageLimitsSetupsTable setups={setups} />;
}

export default function UsageLimitsSetupsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Usage limits setups"
          description="Define monthly credit allowances and per-feature access. User groups reference these setups."
        />
        <Button asChild>
          <Link href="/usage-limits-setups/new">Create setup</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={4} rows={4} />}>
        <UsageLimitsSetupsSection />
      </Suspense>
    </div>
  );
}
