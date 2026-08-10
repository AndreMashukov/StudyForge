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
  usesOverage: boolean;
}

export function useFeatureUsageGate(kind: GenerationKind, quantity = 1): IUseFeatureUsageGateResult {
  const { data, isLoading } = useGetUsageSummaryQuery();
  const feature = data?.featureAvailability.find((entry) => entry.kind === kind);
  const totalCost = (feature?.creditCost ?? 0) * quantity;
  const usesOverage = feature?.usesOverage === true;

  const blockedReason = !feature
    ? 'Usage limits are unavailable.'
    : !feature.enabled
      ? 'This feature is not available on your current plan.'
      : !feature.affordable
        ? data?.payAsYouGo?.enabled
          ? `Pay-as-you-go spending cap reached (${totalCost} credits required).`
          : data?.payAsYouGo?.hasPaymentMethod
            ? `Not enough included credits (${totalCost} required). Enable pay-as-you-go on the Usage page to continue.`
            : `Not enough credits (${totalCost} required).`
        : undefined;

  return {
    isLoading,
    summary: data,
    feature,
    totalCost,
    isBlocked: Boolean(blockedReason),
    blockedReason,
    usesOverage,
  };
}
