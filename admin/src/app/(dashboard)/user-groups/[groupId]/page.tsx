import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { UserGroupForm } from '../../../../components/admin/UserGroupForm';
import { listLlmSetupOptions } from '../../../../lib/data/llm-setups';
import { getUserGroupById, listGroupMembers } from '../../../../lib/data/user-groups';

export default async function UserGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [group, setupOptions, members] = await Promise.all([
    getUserGroupById(groupId),
    listLlmSetupOptions(),
    listGroupMembers(groupId),
  ]);

  if (!group) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/user-groups"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to user groups
      </Link>

      <AdminPageHeader
        title={group.name}
        description={`Linked setup: ${group.llmSetupName ?? group.llmSetupId}`}
      />

      <UserGroupForm
        groupId={group.id}
        defaultValues={{ name: group.name, llmSetupId: group.llmSetupId }}
        setupOptions={setupOptions}
      />

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Assigned users ({members.length})</h2>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No users assigned yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {members.map((member) => (
              <li key={member.uid}>
                <Link href={`/users/${member.uid}`} className="text-primary hover:underline">
                  {member.email}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
