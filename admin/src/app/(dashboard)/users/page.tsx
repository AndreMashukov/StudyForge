import { UsersTable } from '../../../components/admin/UsersTable';
import { listUsers } from '../../../lib/data/users';

export default async function UsersPage() {
  const users = await listUsers({ limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Users</h1>
        <p className="text-muted-foreground">
          Read-only list from Firebase Auth and Firestore user profiles.
        </p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
