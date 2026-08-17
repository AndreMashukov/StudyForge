import { Suspense } from 'react';
import { AdminPageHeader } from '@admin/components/layout/AdminPageHeader';
import { ModelSettingsPanelSkeleton } from '@admin/components/loading';
import {
  buildRouteSummaries,
  listRecentAdminProviderCostPeriodKeys,
  readAdminProviderCostPeriod,
} from '@admin/data/provider-costs';
import { buildUsagePeriodKey } from '@shared-types';
import { ProviderCostsOverview } from './_components/ProviderCostsOverview';

export const dynamic = 'force-dynamic';

interface IProviderCostsPageProps {
  searchParams?: Promise<{ period?: string }>;
}

interface IProviderCostsSectionProps {
  periodKey: string;
}

function isUsagePeriodKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

async function ProviderCostsSection({ periodKey }: IProviderCostsSectionProps) {
  const period = await readAdminProviderCostPeriod(periodKey);
  const routeSummaries = period ? buildRouteSummaries(period) : [];

  return (
    <ProviderCostsOverview
      period={period}
      periodKey={periodKey}
      routeSummaries={routeSummaries}
    />
  );
}

export default async function ProviderCostsPage({ searchParams }: IProviderCostsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedPeriod = resolvedSearchParams.period?.trim() ?? '';
  const periodKey = isUsagePeriodKey(requestedPeriod)
    ? requestedPeriod
    : buildUsagePeriodKey();
  const recentPeriodKeys = listRecentAdminProviderCostPeriodKeys();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Provider costs"
        description="Monthly provider COGS from per-call usage estimates and rate snapshots."
      />

      <div className="flex flex-wrap gap-2">
        {recentPeriodKeys.map((key) => (
          <a
            key={key}
            href={`/provider-costs?period=${encodeURIComponent(key)}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              key === periodKey
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {key}
          </a>
        ))}
      </div>

      <Suspense fallback={<ModelSettingsPanelSkeleton />}>
        <ProviderCostsSection periodKey={periodKey} />
      </Suspense>
    </div>
  );
}
