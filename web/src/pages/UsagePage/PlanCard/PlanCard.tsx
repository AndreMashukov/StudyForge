import React from 'react';
import { formatDateWithOptions } from '../../../utils/dateUtils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';
import { formatCreditCount } from '../utils/usagePageUtils';
import {
  usageDetailLabelClassName,
  usageDetailValueClassName,
  usageSectionCardClassName,
} from '../UsagePage.styles';
import type { IPlanCardProps } from './IPlanCard';

export const PlanCard: React.FC<IPlanCardProps> = ({ summary }) => {
  const planName = summary.usageLimitsSetupName ?? 'Default plan';
  const resetLabel = formatDateWithOptions(summary.resetAt, 'MMM d, yyyy');

  return (
    <Card className={usageSectionCardClassName}>
      <CardHeader className="px-5 py-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold leading-none">Current Plan</CardTitle>
          <CardDescription className="text-sm">{planName}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className={usageDetailLabelClassName}>Monthly allowance</dt>
            <dd className={cn(usageDetailValueClassName, 'tabular-nums')}>
              {formatCreditCount(summary.allowance)} credits
            </dd>
          </div>
          <div className="space-y-1">
            <dt className={usageDetailLabelClassName}>Next reset</dt>
            <dd className={usageDetailValueClassName}>{resetLabel}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};
