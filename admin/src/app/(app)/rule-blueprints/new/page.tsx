import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RuleColor, RuleApplicability } from '@shared-types';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { RuleBlueprintForm } from '@admin/app/(app)/rule-blueprints/_components/RuleBlueprintForm';

export default function NewRuleBlueprintPage() {
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
        title="Create rule blueprint"
        description="Define a canonical rule template for the workspace agent."
      />

      <RuleBlueprintForm
        defaultValues={{
          name: '',
          description: '',
          content: '',
          color: RuleColor.PURPLE,
          tags: [],
          applicableTo: [RuleApplicability.PROMPT],
        }}
      />
    </div>
  );
}
