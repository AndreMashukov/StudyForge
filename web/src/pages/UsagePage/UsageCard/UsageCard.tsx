import React from 'react';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/Card';
import {
  calculateUsedCredits,
  calculateUsagePercent,
  formatCreditCount,
  roundPercent,
} from '../utils/usagePageUtils';
import type { IUsageCardProps } from './IUsageCard';

export const UsageCard: React.FC<IUsageCardProps> = ({ summary }) => {
  const used = calculateUsedCredits(summary);
  const percent = calculateUsagePercent(summary);
  const roundedPercent = roundPercent(percent);
  const remaining = Math.max(0, summary.remainingCredits);
  const resetLabel = formatDateWithOptions(summary.resetAt, 'MMM d, yyyy');
  const percentAriaLabel = `${roundedPercent}% of credits used. ${formatCreditCount(
    remaining,
  )} of ${formatCreditCount(summary.allowance)} credits remaining.`;

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <CardTitle className="text-lg font-semibold leading-none">Monthly Credits</CardTitle>
            <span className="text-sm text-muted-foreground" aria-hidden>
              ·
            </span>
            <CardDescription className="text-sm">Resets on {resetLabel}</CardDescription>
          </div>
          <span
            className="text-sm font-medium text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {roundedPercent}% used
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPercent}
          aria-label={percentAriaLabel}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {formatCreditCount(remaining)} of {formatCreditCount(summary.allowance)} credits remaining
          this period. {formatCreditCount(used)} used.
        </p>
      </CardContent>
    </Card>
  );
};
