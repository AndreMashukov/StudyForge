import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { RuleBlueprintForm } from '@admin/app/(app)/rule-blueprints/_components/RuleBlueprintForm';
import { getRuleBlueprint } from '@admin/data/rule-blueprints';

interface IPageProps {
  params: Promise<{ blueprintId: string }>;
}

export default async function EditRuleBlueprintPage({ params }: IPageProps) {
  const { blueprintId } = await params;
  const blueprint = await getRuleBlueprint(blueprintId);

  if (!blueprint) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/rule-blueprints"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to rule blueprints
      </Link>

      <AdminPageHeader
        title={blueprint.name}
        description="Edit platform rule blueprint for the workspace agent."
      />

      <RuleBlueprintForm
        blueprintId={blueprint.id}
        defaultValues={{
          name: blueprint.name,
          description: blueprint.description,
          content: blueprint.content,
          color: blueprint.color,
          tags: blueprint.tags,
          applicableTo: blueprint.applicableTo,
        }}
        status={blueprint.status}
        version={blueprint.version}
      />
    </div>
  );
}
