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
import {
  usageMeterCardClassName,
  usageMeterHeaderClassName,
  usageMeterProgressFillClassName,
  usageMeterProgressTrackClassName,
  usageMeterStatPillClassName,
} from '../UsagePage.styles';
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
    <Card className={usageMeterCardClassName}>
      <CardHeader className="px-5 py-4">
        <div className={usageMeterHeaderClassName}>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold leading-none">Monthly Credits</CardTitle>
            <CardDescription className="text-sm">Resets on {resetLabel}</CardDescription>
          </div>
          <span className={usageMeterStatPillClassName} aria-live="polite">
            {roundedPercent}% used
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5 pt-0">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPercent}
          aria-label={percentAriaLabel}
          className={usageMeterProgressTrackClassName}
        >
          <div
            className={usageMeterProgressFillClassName}
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
