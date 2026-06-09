import Link from 'next/link';
import { IAdminUserSummary } from '../../../types/IAdminUserSummary';
import { Badge } from '../../ui/Badge';

export interface IUsersTableProps {
  users: IAdminUserSummary[];
}

export function UsersTable({ users }: IUsersTableProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No users found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">
              Email
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              UID
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Created
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.uid} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/users/${user.uid}`}
                  className="font-medium text-primary hover:underline"
                >
                  {user.email}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {user.uid}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleString()
                  : '—'}
              </td>
              <td className="px-4 py-3">
                {user.disabled ? (
                  <Badge variant="secondary">Disabled</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
