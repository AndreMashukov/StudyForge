import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { UserGroupAssignmentForm } from '@admin/app/(app)/users/[userId]/_components/UserGroupAssignmentForm';
import { UserDetailCardSkeleton } from '@admin/components/loading';
import { Badge } from '@admin/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@admin/components/ui/Card';
import { listUserGroupOptions } from '@admin/data/user-groups';
import { getUserById } from '@admin/data/users';
import { getAdminUserUsageReport } from '@admin/data/user-usage';
import { UserUsageReportCard } from '@admin/app/(app)/users/[userId]/_components/UserUsageReportCard';

async function UserDetailSection({ userId }: { userId: string }) {
  const [user, groupOptions, usageReport] = await Promise.all([
    getUserById(userId),
    listUserGroupOptions(),
    getAdminUserUsageReport(userId),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{user.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">UID:</span>{' '}
            <code className="font-mono text-xs">{user.uid}</code>
          </p>
          {user.displayName ? (
            <p>
              <span className="text-muted-foreground">Display name:</span>{' '}
              {user.displayName}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Created:</span>{' '}
            {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Group:</span>{' '}
            {user.userGroupName ?? (user.userGroupId ? user.userGroupId : 'Unassigned')}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{' '}
            {user.disabled ? (
              <Badge variant="secondary">Disabled</Badge>
            ) : (
              <Badge variant="default">Active</Badge>
            )}
          </p>
        </CardContent>
      </Card>

      <UserUsageReportCard report={usageReport} />

      <UserGroupAssignmentForm
        userId={user.uid}
        currentGroupId={user.userGroupId}
        groupOptions={groupOptions}
      />
    </div>
  );
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to users
      </Link>

      <Suspense fallback={<UserDetailCardSkeleton />}>
        <UserDetailSection userId={userId} />
      </Suspense>
    </div>
  );
}
