import type { IUserUsageSummary } from '@shared-types';

export interface IPayAsYouGoCardProps {
  summary: IUserUsageSummary;
  monthlyCapDollars: string;
  isSaving: boolean;
  billingError?: string | null;
  onMonthlyCapChange: (value: string) => void;
  onSaveMonthlyCap: () => void;
  onEnablePayAsYouGo: () => void;
  onDisablePayAsYouGo: () => void;
  onSetupBilling: () => void;
  onManageBilling: () => void;
}
