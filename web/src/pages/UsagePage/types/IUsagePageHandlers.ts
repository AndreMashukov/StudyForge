export interface IUsagePageHandlers {
  isSaving: boolean;
  billingError: string | null;
  clearBillingError: () => void;
  handleSetupBilling: (usageLimitsSetupId: string) => Promise<void>;
  handleManageBilling: () => Promise<void>;
  handleEnablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
  handleDisablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
  handleUpdateMonthlyCap: (monthlyCapDollars: string, enabled: boolean) => Promise<void>;
}
