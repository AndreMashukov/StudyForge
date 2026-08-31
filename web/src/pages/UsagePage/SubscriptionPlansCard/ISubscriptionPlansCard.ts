import type { ISubscriptionPlanSummary, IUserUsageSummary } from '@shared-types';

export interface ISubscriptionPlansCardProps {
  summary: IUserUsageSummary;
  plans: ISubscriptionPlanSummary[];
  isLoading: boolean;
  isSaving: boolean;
  onSelectPlan: (usageLimitsSetupId: string) => void;
  onManageBilling: () => void;
}
