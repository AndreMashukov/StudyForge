import React from 'react';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/Card';
import { formatCreditCount } from '../utils/usagePageUtils';
import type { IPlanCardProps } from './IPlanCard';

export const PlanCard: React.FC<IPlanCardProps> = ({ summary }) => {
  const planName = summary.usageLimitsSetupName ?? 'Default plan';
  const resetLabel = formatDateWithOptions(summary.resetAt, 'MMM d, yyyy');

  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-semibold leading-none">Current Plan</CardTitle>
          <CardDescription className="text-sm">{planName}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Monthly allowance
            </dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {formatCreditCount(summary.allowance)} credits
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next reset
            </dt>
            <dd className="text-sm font-medium text-foreground">{resetLabel}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};
