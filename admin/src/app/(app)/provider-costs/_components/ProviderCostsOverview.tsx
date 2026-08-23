import type {
  IAdminProviderCostPeriod,
  IProviderCostBucket,
  IProviderRateCatalogEntry,
} from '@shared-types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@admin/components/ui/Card';

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return '0%';
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function BucketTable(props: {
  title: string;
  buckets: Record<string, IProviderCostBucket>;
}) {
  const rows = Object.entries(props.buckets).sort(
    (left, right) => right[1].knownCostUsd - left[1].knownCostUsd,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No data yet for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Known cost</th>
                  <th className="py-2 pr-4 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, bucket]) => (
                  <tr key={name} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">{name}</td>
                    <td className="py-2 pr-4">
                      {formatUsd(bucket.knownCostUsd)}
                    </td>
                    <td className="py-2 pr-4">{bucket.eventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRate(value?: number): string {
  if (value === undefined) {
    return 'N/A';
  }
  return formatUsd(value);
}

function RateCatalogTable(props: { entries: IProviderRateCatalogEntry[] }) {
  if (props.entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rate catalog documents yet. Test or save a provider connection to
        sync Together, OpenRouter, Gemini, and MiniMax rates into Firestore.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Provider</th>
            <th className="py-2 pr-4 font-medium">Model</th>
            <th className="py-2 pr-4 font-medium">Meter</th>
            <th className="py-2 pr-4 font-medium">Input / 1M</th>
            <th className="py-2 pr-4 font-medium">Output / 1M</th>
            <th className="py-2 pr-4 font-medium">Cached / 1M</th>
            <th className="py-2 pr-4 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {props.entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/60">
              <td className="py-2 pr-4 font-mono text-xs">
                {entry.providerKind}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{entry.model}</td>
              <td className="py-2 pr-4">{entry.meter}</td>
              <td className="py-2 pr-4">
                {entry.meter === 'image_megapixel'
                  ? formatRate(entry.imageUsdPerMegapixel)
                  : formatRate(entry.inputUsdPer1M)}
              </td>
              <td className="py-2 pr-4">{formatRate(entry.outputUsdPer1M)}</td>
              <td className="py-2 pr-4">
                {formatRate(entry.cachedInputUsdPer1M)}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {entry.source ?? 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface IProviderCostsOverviewProps {
  period: IAdminProviderCostPeriod | null;
  periodKey: string;
  routeSummaries: Array<{
    route: string;
    knownCostUsd: number;
    eventCount: number;
    committedCredits: number;
    costUsdPerCredit?: number;
  }>;
  rateCatalog: IProviderRateCatalogEntry[];
}

export function ProviderCostsOverview({
  period,
  periodKey,
  routeSummaries,
  rateCatalog,
}: IProviderCostsOverviewProps) {
  if (!period) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              No provider cost data for {periodKey} yet. Costs are recorded from
              deploy time forward.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rate catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">
              Firestore providerRateCatalog. Synced from provider list-models
              responses when you test or save a connection.
            </p>
            <RateCatalogTable entries={rateCatalog} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unknownPercent = formatPercent(
    period.unknownCostEventCount,
    period.totalEventCount,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Known provider cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatUsd(period.knownCostUsd)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gross COGS including failed and retried calls with known usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Committed credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {period.committedCredits.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Cost per committed credit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {period.costUsdPerCommittedCredit !== undefined
                ? formatUsd(period.costUsdPerCommittedCredit)
                : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unknown-cost events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {period.unknownCostEventCount.toLocaleString()} ({unknownPercent})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {period.totalEventCount.toLocaleString()} total provider calls
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost per credit by route</CardTitle>
        </CardHeader>
        <CardContent>
          {routeSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No route breakdown yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Generation kind</th>
                    <th className="py-2 pr-4 font-medium">Known cost</th>
                    <th className="py-2 pr-4 font-medium">Events</th>
                    <th className="py-2 pr-4 font-medium">Cost / credit</th>
                  </tr>
                </thead>
                <tbody>
                  {routeSummaries.map((row) => (
                    <tr key={row.route} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.route}
                      </td>
                      <td className="py-2 pr-4">
                        {formatUsd(row.knownCostUsd)}
                      </td>
                      <td className="py-2 pr-4">{row.eventCount}</td>
                      <td className="py-2 pr-4">
                        {row.costUsdPerCredit !== undefined
                          ? formatUsd(row.costUsdPerCredit)
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <BucketTable title="By provider" buckets={period.byProvider} />
        <BucketTable title="By model" buckets={period.byModel} />
        <BucketTable
          title="By generation kind"
          buckets={period.byGenerationKind}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rate catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            Firestore providerRateCatalog. Synced from provider list-models
            responses when you test or save a connection.
          </p>
          <RateCatalogTable entries={rateCatalog} />
        </CardContent>
      </Card>
    </div>
  );
}
