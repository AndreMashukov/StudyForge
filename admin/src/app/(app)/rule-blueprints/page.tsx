import Link from 'next/link';
import { Suspense } from 'react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { Button } from '@admin/components/ui/Button';
import { TableSkeleton } from '@admin/components/loading';
import { RuleBlueprintsTable } from '@admin/app/(app)/rule-blueprints/_components/RuleBlueprintsTable';
import { listRuleBlueprints } from '@admin/data/rule-blueprints';

async function RuleBlueprintsSection() {
  const blueprints = await listRuleBlueprints();
  return <RuleBlueprintsTable blueprints={blueprints} />;
}

export default function RuleBlueprintsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="Rule blueprints"
          description="Platform rule templates the workspace agent uses when creating user rules."
        />
        <Button asChild>
          <Link href="/rule-blueprints/new">Create blueprint</Link>
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton columns={5} rows={5} />}>
        <RuleBlueprintsSection />
      </Suspense>
    </div>
  );
}
