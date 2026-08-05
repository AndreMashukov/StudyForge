import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { UsageLimitsSetupForm } from '../../../../components/admin/UsageLimitsSetupForm';
import { featurePoliciesToFormValues } from '../../../../components/admin/UsageLimitsSetupForm/UsageLimitsSetupForm.form';
import { getUsageLimitsSetupById } from '../../../../lib/data/usage-limits-setups';

export default async function UsageLimitsSetupDetailPage({
  params,
}: {
  params: Promise<{ setupId: string }>;
}) {
  const { setupId } = await params;
  const setup = await getUsageLimitsSetupById(setupId);

  if (!setup) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/usage-limits-setups"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to usage limits setups
      </Link>

      <AdminPageHeader
        title={setup.name}
        description={setup.description ?? 'Edit monthly credits and feature access for this setup.'}
      />

      <UsageLimitsSetupForm
        setupId={setup.id}
        defaultValues={featurePoliciesToFormValues(
          setup.name,
          setup.description,
          setup.monthlyCreditAllowance,
          setup.featurePolicies
        )}
      />
    </div>
  );
}
