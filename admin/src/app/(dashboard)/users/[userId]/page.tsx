import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { getUserById } from '../../../../lib/data/users';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getUserById(userId);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to users
      </Link>

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
            {user.createdAt
              ? new Date(user.createdAt).toLocaleString()
              : '—'}
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
    </div>
  );
}
