import Link from 'next/link';
import type { IAdminUsageLimitsSetupSummary } from '@admin/data/usage-limits-setups';
import { formatStorageLimitLabel } from '@admin/app/(app)/usage-limits-setups/_components/UsageLimitsSetupForm/UsageLimitsSetupForm.form';
import { Badge } from '@admin/components/ui/Badge';

export interface IUsageLimitsSetupsTableProps {
  setups: IAdminUsageLimitsSetupSummary[];
}

export function UsageLimitsSetupsTable({ setups }: IUsageLimitsSetupsTableProps) {
  if (setups.length === 0) {
    return <p className="text-sm text-muted-foreground">No usage limits setups yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">
              Name
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Monthly allowance
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Storage
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Daily slide decks
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Enabled features
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Groups
            </th>
          </tr>
        </thead>
        <tbody>
          {setups.map((setup) => (
            <tr key={setup.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/usage-limits-setups/${setup.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {setup.name}
                </Link>
                {setup.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{setup.description}</p>
                ) : null}
              </td>
              <td className="px-4 py-3">{setup.monthlyCreditAllowance.toLocaleString()}</td>
              <td className="px-4 py-3">{formatStorageLimitLabel(setup.storageLimitBytes)}</td>
              <td className="px-4 py-3">{setup.dailySlideDeckLimit.toLocaleString()}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{setup.enabledFeatureCount} enabled</Badge>
              </td>
              <td className="px-4 py-3">{setup.referencedGroupCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
