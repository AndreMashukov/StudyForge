import React from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { formatCurrencyFromCents } from '@shared-types';
import type { GenerationKind } from '@shared-types';
import { useGetUsageSummaryQuery } from '../../store/api/Usage/usageApi';

export interface IUsageActionHintProps {
  kind: GenerationKind;
  quantity?: number;
}

export const UsageActionHint: React.FC<IUsageActionHintProps> = ({ kind, quantity = 1 }) => {
  const { data } = useGetUsageSummaryQuery();
  const feature = data?.featureAvailability.find((entry) => entry.kind === kind);

  if (!feature) {
    return null;
  }

  const totalCost = feature.creditCost * quantity;
  const resetLabel = data ? format(new Date(data.resetAt), 'MMM d') : '';
  const remainingIncluded = data?.remainingCredits ?? 0;
  const includedPortion = Math.min(remainingIncluded, totalCost);
  const overageCredits = Math.max(0, totalCost - includedPortion);
  const overageAmountCents =
    overageCredits * (data?.payAsYouGo?.pricePerCreditCents ?? 0);

  if (!feature.enabled) {
    return (
      <p className="text-sm text-destructive" role="alert">
        This feature is not available on your current plan.
      </p>
    );
  }

  if (!feature.affordable) {
    const payAsYouGo = data?.payAsYouGo;
    if (payAsYouGo?.enabled) {
      return (
        <p className="text-sm text-destructive" role="alert">
          Pay-as-you-go spending cap reached for this month. Adjust your cap on the{' '}
          <Link to="/usage" className="underline underline-offset-2">
            Usage page
          </Link>
          .
        </p>
      );
    }

    if (payAsYouGo?.hasPaymentMethod) {
      return (
        <p className="text-sm text-destructive" role="alert">
          Not enough included credits ({totalCost} required). Enable pay-as-you-go on the{' '}
          <Link to="/usage" className="underline underline-offset-2">
            Usage page
          </Link>{' '}
          to continue.
        </p>
      );
    }

    return (
      <p className="text-sm text-destructive" role="alert">
        Not enough credits ({totalCost} required, {remainingIncluded} remaining). Credits reset on{' '}
        {resetLabel}.
      </p>
    );
  }

  if (feature.usesOverage) {
    return (
      <p className="text-sm text-muted-foreground">
        Costs {totalCost} credit{totalCost === 1 ? '' : 's'} via pay-as-you-go (
        {formatCurrencyFromCents(overageAmountCents)} estimated overage).
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Costs {totalCost} credit{totalCost === 1 ? '' : 's'}. {remainingIncluded.toLocaleString()}{' '}
      remaining until {resetLabel}.
    </p>
  );
};
