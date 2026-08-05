import type { GenerationKind } from '@shared-types';
import { format } from 'date-fns';
import { Gauge } from 'lucide-react';
import { useGetUsageSummaryQuery } from '../../store/api/Usage/usageApi';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';

export interface IUsageCreditsMeterProps {
  className?: string;
}

export function UsageCreditsMeter({ className }: IUsageCreditsMeterProps) {
  const { data, isLoading, isError } = useGetUsageSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });

  if (isLoading) {
    return <Spinner size="sm" variant="muted" className={className} />;
  }

  if (isError || !data) {
    return null;
  }

  const resetLabel = format(new Date(data.resetAt), 'MMM d');

  return (
    <Badge variant="secondary" className={className} title={`Credits reset on ${resetLabel}`}>
      <Gauge className="mr-1 h-3.5 w-3.5" aria-hidden />
      {data.remainingCredits.toLocaleString()} / {data.allowance.toLocaleString()} credits
    </Badge>
  );
}

export interface IUsageActionHintProps {
  kind: GenerationKind;
  quantity?: number;
}

export function UsageActionHint({ kind, quantity = 1 }: IUsageActionHintProps) {
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
        Not enough credits ({totalCost} required, {data?.remainingCredits ?? 0} remaining). Credits reset on {resetLabel}.
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Costs {totalCost} credit{totalCost === 1 ? '' : 's'}. {(data?.remainingCredits ?? 0).toLocaleString()} remaining until {resetLabel}.
    </p>
  );
}

export function useFeatureUsageGate(kind: GenerationKind, quantity = 1) {
  const { data, isLoading } = useGetUsageSummaryQuery();
  const feature = data?.featureAvailability.find((entry) => entry.kind === kind);
  const totalCost = (feature?.creditCost ?? 0) * quantity;

  const blockedReason = !feature
    ? 'Usage limits are unavailable.'
    : !feature.enabled
      ? 'This feature is not available on your current plan.'
      : data && data.remainingCredits < totalCost
        ? `Not enough credits (${totalCost} required).`
        : undefined;

  return {
    isLoading,
    summary: data,
    feature,
    totalCost,
    isBlocked: Boolean(blockedReason),
    blockedReason,
  };
}
