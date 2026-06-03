import Link from 'next/link';
import { Users, FileText, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { listUsers } from '../../lib/data/users';
import { listRecentDocuments } from '../../lib/data/documents';

export default async function DashboardPage() {
  const [users, documents] = await Promise.all([
    listUsers({ limit: 5 }),
    listRecentDocuments(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and quick links for operator workflows.
        </p>
      </div>

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
    </div>
  );
}
