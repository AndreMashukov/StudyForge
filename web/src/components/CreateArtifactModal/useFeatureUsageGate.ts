import type {
  GenerationKind,
  IUsageFeatureAvailability,
  IUserUsageSummary,
} from '@shared-types';
import { useGetUsageSummaryQuery } from '../../store/api/Usage/usageApi';

export interface IUseFeatureUsageGateResult {
  isLoading: boolean;
  summary: IUserUsageSummary | undefined;
  feature: IUsageFeatureAvailability | undefined;
  totalCost: number;
  isBlocked: boolean;
  blockedReason: string | undefined;
}

export function useFeatureUsageGate(kind: GenerationKind, quantity = 1): IUseFeatureUsageGateResult {
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
