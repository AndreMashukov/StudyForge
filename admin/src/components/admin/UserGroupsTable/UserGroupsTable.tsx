import Link from 'next/link';
import type { IAdminUserGroupSummary } from '../../../lib/data/user-groups';

export interface IUserGroupsTableProps {
  groups: IAdminUserGroupSummary[];
}

export function UserGroupsTable({ groups }: IUserGroupsTableProps) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No user groups yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">Name</th>
            <th className="px-4 py-3 font-medium" scope="col">LLM setup</th>
            <th className="px-4 py-3 font-medium" scope="col">Members</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link href={`/user-groups/${group.id}`} className="font-medium text-primary hover:underline">
                  {group.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {group.llmSetupName ?? group.llmSetupId}
              </td>
              <td className="px-4 py-3">{group.memberCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
