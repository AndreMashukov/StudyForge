import { Suspense } from 'react';
import Link from 'next/link';
import { Users, FileText, Activity } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { DashboardCardsSkeleton } from '../../components/admin/loading';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';
import { listUsers } from '../../lib/data/users';
import { listRecentDocuments } from '../../lib/data/documents';

async function DashboardStats() {
  const [users, documents] = await Promise.all([
    listUsers({ limit: 5 }),
    listRecentDocuments(5),
  ]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{users.length}+</p>
          <CardDescription>Sample from latest Auth listing</CardDescription>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Documents</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{documents.length}</p>
          <CardDescription>Recent docs across sampled users</CardDescription>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-primary">OK</p>
          <CardDescription>
            <Link href="/api/health" className="hover:underline">
              /api/health
            </Link>
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Platform overview and quick links for operator workflows."
      />

      <Suspense fallback={<DashboardCardsSkeleton />}>
        <DashboardStats />
      </Suspense>
    </div>
  );
}
