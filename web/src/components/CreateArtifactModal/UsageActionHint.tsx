import React from 'react';
import { format } from 'date-fns';
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

  if (!feature.enabled) {
    return (
      <p className="text-sm text-destructive" role="alert">
        This feature is not available on your current plan.
      </p>
    );
  }

  if (!feature.affordable || (data !== undefined && data.remainingCredits < totalCost)) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Not enough credits ({totalCost} required, {data?.remainingCredits ?? 0} remaining). Credits
        reset on {resetLabel}.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Costs {totalCost} credit{totalCost === 1 ? '' : 's'}.{' '}
      {(data?.remainingCredits ?? 0).toLocaleString()} remaining until {resetLabel}.
    </p>
  );
};
