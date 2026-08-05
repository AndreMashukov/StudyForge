import { format } from 'date-fns';
import type { IAdminUserUsageReport } from '../../../lib/data/user-usage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';

export interface IUserUsageReportCardProps {
  report: IAdminUserUsageReport | null;
}

export function UserUsageReportCard({ report }: IUserUsageReportCardProps) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Usage data is unavailable. Assign the user to a group with a usage limits setup.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { period, recentEvents } = report;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Setup:</span>{' '}
            {period.usageLimitsSetupName ?? period.usageLimitsSetupId}
          </p>
          <p>
            <span className="text-muted-foreground">Period:</span> {period.periodKey}
          </p>
          <p>
            <span className="text-muted-foreground">Remaining:</span>{' '}
            {period.remainingCredits.toLocaleString()} / {period.allowance.toLocaleString()}
          </p>
          <p>
            <span className="text-muted-foreground">Resets:</span>{' '}
            {format(new Date(period.resetAt), 'PPP')}
          </p>
          <p>
            <span className="text-muted-foreground">Spent:</span> {period.spentCredits.toLocaleString()}
          </p>
          <p>
            <span className="text-muted-foreground">Reserved:</span>{' '}
            {period.reservedCredits.toLocaleString()}
          </p>
        </div>

        <div>
          <h3 className="mb-2 font-medium">Recent events</h3>
          {recentEvents.length === 0 ? (
            <p className="text-muted-foreground">No usage events recorded this period.</p>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((event) => (
                <li key={String(event.id)} className="rounded-md border border-border px-3 py-2">
                  <div className="font-medium">
                    {String(event.type)} · {String(event.generationKind)} · {String(event.credits)} credits
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {typeof event.createdAt === 'string'
                      ? format(new Date(event.createdAt), 'PPpp')
                      : 'Unknown time'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
